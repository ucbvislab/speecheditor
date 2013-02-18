// jQuery plugin to show a music timeline with moving (and scrubbable) bar

// ok, way fancier than that now

// also requires underscore-observable. some plugin, eh?
;(function ($, window, document, undefined) {
    var pluginName = "timeline";
    var defaults = {
        'reauthoredWaveform':  undefined,
        'sound': undefined,
        'play': true,
        'width': undefined,
        'height': undefined,
        'barColor': '#000000',
        'barWidth': 3,
        'callback': undefined,
        'resizeToFit': true,
        'origWaveform': undefined,
        'origSound': undefined,
        'current': undefined
    };
    
    var clearCanvas = function (canvas, ctx) {
    	// Store the current transformation matrix
    	ctx.save();

    	// Use the identity matrix while clearing the canvas
    	ctx.setTransform(1, 0, 0, 1, 0, 0);
    	ctx.clearRect(0, 0, canvas.width, canvas.height);

    	// Restore the transform
    	ctx.restore();
    };

    var moveCanvas = function (fromCanvas, toCanvas) {
        var toContext = toCanvas.getContext('2d');
        clearCanvas(toCanvas, toContext);
        toContext.drawImage(fromCanvas, 0, 0);
    };

    var drawSeparators = function (ctx) {
        var settings = $(this).data('timeline');
        var seps = [];
        if (settings !== undefined) {
            seps = settings.seps;
        }
        _.each(seps, function (s) {
            ctx.save();
            ctx.strokeStyle = "blue";
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(s, 0);
            ctx.lineTo(s, settings.height);
            ctx.stroke();
            ctx.restore();  
        });
    };

    var updatePlayhead = function (pos) {
        // pos is in milliseconds
        console.log("in update playhead");
        var $this = $(this);
        var settings = $this.data('timeline');
        var tmpCanvas = $this.find('.timelineTmpCanvas')[0];
        var mainCanvas = $this.find('.timelineMainCanvas')[0];
        var mainCtx = mainCanvas.getContext('2d');
        moveCanvas(tmpCanvas, mainCanvas);
        mainCtx.fillStyle = settings.barColor;
        mainCtx.fillRect(pos /
            parseFloat(settings.sound.duration) *
            parseFloat(settings.width), 0, 
            settings.barWidth, settings.height);
    };

    var scrub = function (event) {
        event = event || window.event;
        var $this = $(this);
        var settings = $this.data('timeline');
        var mainCanvas = $this.find('.timelineMainCanvas')[0];
        var x = event.pageX - mainCanvas.offsetLeft;
        if (x <= 0) x = 0;
        if (settings.sound !== undefined) {
            settings.sound.setPosition(x * 
                parseFloat(settings.sound.duration) / 
                parseFloat(settings.width));
        }
        console.log("scrubbed to", x)
        updatePlayhead.apply(this, [x *
            parseFloat(settings.sound.duration) /
            parseFloat(settings.width)]);
    };

    var methods = {
        init: function (options) {
            var settings = $.extend({}, defaults, options);
            var tmpCanvas;
            var mainCanvas;
            var tmpCtx;
            var mainCtx;
            var origCanvas;
            var origCtx;
            var origTmpCanvas;
            var origTmpCtx;
            var $this = $(this);
            var data = $this.data('timeline');
            
            settings.width = settings.width || this.width();
            settings.height = settings.height || this.height();

            if (!data) {
                $this.data('timeline', settings);
            }

            tmpCanvas = document.createElement('canvas');
            $(tmpCanvas).attr("width", settings.width)
                .attr("height", settings.height)
                .addClass('timelineTmpCanvas')
                .css("display", "none");

            mainCanvas = document.createElement('canvas');
            $(mainCanvas).attr("width", settings.width)
                .addClass('timelineMainCanvas')
                .attr("height", settings.height);

            origCanvas = document.createElement('canvas');
            $(origCanvas).css("display", "none");

            origTmpCanvas = document.createElement('canvas');
            $(origTmpCanvas).css("display", "none");

            tmpCtx = tmpCanvas.getContext('2d');
            mainCtx = mainCanvas.getContext('2d');
            origCtx = origCanvas.getContext('2d');
            origTmpCtx = origTmpCanvas.getContext('2d');

            this.append(mainCanvas)
                .append(tmpCanvas)
                .append(origCanvas)
                .append(origTmpCanvas);

            // init origCanvas with orignal waveform
            var origWaveformImg = new Image();
            origWaveformImg.onload = function () {
                $(origCanvas).attr("width", this.width)
                    .attr("height", this.height);
                origCtx.drawImage(origWaveformImg, 0, 0,
                    this.width, this.height);
                _.observe(settings.current, function () {
                    console.log("TL observed change");
                    $(mainCanvas).unbind('click.timelineScrub');
                    drawCurrentWaveform.apply($this[0]);
                });
            };
            origWaveformImg.src = settings.origWaveform;
            
            var drawCurrentWaveform = function () {
                console.log("in draw current waveform");
                var ctx = origTmpCtx;
                var canv = origTmpCanvas;
                var w = $(origCanvas).width();
                var h = settings.height;
                var pixPerMS = parseFloat(w) /
                    parseFloat(settings.origSound.duration);
                clearCanvas(canv, ctx);
                var i, start, end, delta, word;
                
                var totalPixels = _.reduce(settings.current, function (m, w) {
                    if (w.alignedWord === "gp") {
                        return m + parseInt(w.pauseLength * 1000.0 *
                            pixPerMS);
                    }
                    start = parseInt(w.start * 1000.0 * pixPerMS);
                    end = parseInt(w.end * 1000.0 * pixPerMS);
                    delta = end - start;
                    return m + delta;
                }, 0);
                if (totalPixels === 0) {
                    clearCanvas(mainCanvas, mainCtx);
                    clearCanvas(tmpCanvas, tmpCtx);
                    return;
                }
                
                $(canv).attr("height", h)
                    .attr("width", totalPixels);

                var currentPixel = 0;
                var prevWordOrigPos = 0;
                var seps = [];
                for (i = 0; i < settings.current.length; i++) {
                    word = settings.current[i];
                    if (word.alignedWord !== "gp") {
                        start = parseInt(word.start * 1000.0 * pixPerMS);
                        end = parseInt(word.end * 1000.0 * pixPerMS);
                        delta = end - start;
                        if (delta > 0) {
                            ctx.drawImage(origCanvas, start, 0, delta, h,
                                          currentPixel, 0, delta, h);
                        }
                        if (prevWordOrigPos + 1 !== word.origPos) {
                            seps.push(currentPixel);
                        }
                        prevWordOrigPos = word.origPos;
                        currentPixel += delta; 
                    } else {
                        seps.push(currentPixel);
                        currentPixel += parseInt(word.pauseLength * 1000.0 *
                            pixPerMS);
                        prevWordOrigPos = -999;
                    }
                }
                
                clearCanvas(mainCanvas, mainCtx);
                mainCtx.drawImage(canv, 0, 0,
                    $(mainCanvas).width(), settings.height);
                    
                // draw separators
                var diffFactor = $(mainCanvas).width() /
                    parseFloat(currentPixel);
                $this.data('timeline').seps = _.map(seps, function(s) {
                    return s * diffFactor;
                });
                drawSeparators.apply(this, [mainCtx]);

                // draw box around the whole thing
                mainCtx.strokeRect(0, 0, settings.width, settings.height);
            };
            
            var timelineThis = this;
            $(window).bind('resize.timeline', function () {
                if (settings.resizeToFit) {
                    settings.width = timelineThis.width();
                    $(tmpCanvas).attr("width", settings.width)
                        .attr("height", settings.height);
                    $(mainCanvas).attr("width", settings.width)
                        .attr("height", settings.height);
                    methods.updateRendered.apply(
                        timelineThis, [settings.reauthoredWaveform]);
                }
            });
            
            console.log("am i here?", settings.width, settings.height);
            methods.updateRendered.apply(this, [settings.reauthoredWaveform]);
            if (settings.play) {
                settings.sound.play();
            }
            return this;
        },
        updateRendered: function (imgUrl, options) {
            console.log("update reauthored waveform");
            var $this = $(this);
            var that = this;
            var tmpCanvas = $this.find('.timelineTmpCanvas')[0];
            var mainCanvas = $this.find('.timelineMainCanvas')[0];
            var tmpCtx = tmpCanvas.getContext('2d');
            var settings = $this.data('timeline');
        	var waveform = new Image();
            
        	clearCanvas(tmpCanvas, tmpCtx);
            
        	waveform.onload = function() {
        		tmpCtx.drawImage(waveform, 0, 0, settings.width,
                     settings.height);
                tmpCtx.strokeRect(0, 0, settings.width, settings.height);
                drawSeparators.apply(that, [tmpCtx]);
        		moveCanvas(tmpCanvas, mainCanvas);
                if (settings.callback) {
                    settings.callback();
                }
        	}
            settings.reauthoredWaveform = imgUrl;
        	waveform.src = settings.reauthoredWaveform;
            
            // process other options (will only exist if it's a new sound)
            settings = $.extend(settings, options);            
            if (options !== undefined) {
                if (settings.sound !== undefined) {
                    $(mainCanvas).bind('click.timelineScrub', 
                        function (event) {
                            scrub.apply($this[0], [event]);
                        });
                    settings.sound.options.whileplaying = function () {
                         updatePlayhead.apply($this[0], [this.position]);
                    };
                    if (options.play === true) {
                        settings.sound.play();
                    }
                }
                if (options.callback !== undefined) {
                    options.callback();
                }
            }
        },
        destroy: function () {
            this.html("");
            return this.each(function(){
                $(window).unbind('.timeline');
            })
            var $this = $(this);
            $this.removeData('timeline');
            return this;
        }
    };
    
    $.fn.timeline = function (method) {
        if (methods[method]) {
            return methods[method].apply(this,
                Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        }
        $.error('Method ' + method + 'does not exist on jQuery.timeline');
    }
})(jQuery, window, document);