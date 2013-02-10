// jQuery plugin to show a music timeline with moving (and scrubbable) bar

// ok, way fancier than that now

// also requires underscore-observable. some plugin, eh?
(function ($) {
    
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
    
    var methods = {
        init: function (options) {
            var settings = $.extend({}, defaults, options);
            var duration = settings.sound.duration;
            var origDuration = settings.origSound.duration;
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
                .css("display", "none");

            mainCanvas = document.createElement('canvas');
            $(mainCanvas).attr("width", settings.width)
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
                    drawCurrentWaveform();
                });
            };
            origWaveformImg.src = settings.origWaveform;
        
            // all of the functions we need to work our magic
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
        
            var drawReauthoredWaveform = function () {
                console.log("draw reauthored waveform");
            	clearCanvas(tmpCanvas, tmpCtx);	
            	var waveform = new Image();
            	waveform.onload = function() {
            		tmpCtx.drawImage(waveform, 0, 0, settings.width,
                         settings.height);
                    tmpCtx.strokeRect(0, 0, settings.width, settings.height);
                    drawSeparators(tmpCtx);
            		moveCanvas(tmpCanvas, mainCanvas);
                    if (settings.callback) {
                        settings.callback();
                    }
            	}
            	waveform.src = settings.reauthoredWaveform;
            };
            
            var drawCurrentWaveform = function () {
                console.log("in draw current waveform");
                var ctx = origTmpCtx;
                var canv = origTmpCanvas;
                var w = $(origCanvas).width();
                var h = settings.height;
                var pixPerMS = parseFloat(w) / parseFloat(origDuration);
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
                    return;
                }
                
                $(canv).attr("height", h)
                    .attr("width", totalPixels);

                var currentPixel = 0;
                var prevWordOrigPos = 0;
                var seps = [];
                console.log(settings.current);
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
                drawSeparators(mainCtx);

                // draw box around the whole thing
                mainCtx.strokeRect(0, 0, settings.width, settings.height);
            };
            
            var drawSeparators = function (ctx) {
                var seps = $this.data('timeline').seps;
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
        
            var scrub = function (event) {
                event = event || window.event;
                var x = event.pageX - mainCanvas.offsetLeft;
                if (x <= 0) x = 0;
                if (settings.sound !== undefined) {
                    settings.sound.setPosition(x * parseFloat(duration) / 
                        parseFloat(settings.width));
                }
                console.log("scrubbed to", x)
                updatePlayhead(x * parseFloat(duration) /
                     parseFloat(settings.width));
            };

            var updatePlayhead = function (pos) {
                // pos is in milliseconds
                moveCanvas(tmpCanvas, mainCanvas);
                mainCtx.fillStyle = settings.barColor;
                mainCtx.fillRect(pos / parseFloat(duration) *
                    parseFloat(settings.width), 0, 
                    settings.barWidth, settings.height);
            };
        
            settings.sound.options.whileplaying = function () {
                 updatePlayhead(this.position);
            };
            
            $(mainCanvas).click(scrub);
            
            var timelineThis = this;
            $(window).bind('resize.timeline', function () {
                if (settings.resizeToFit) {
                    settings.width = timelineThis.width();
                    $(tmpCanvas).attr("width", settings.width)
                        .attr("height", settings.height);
                    $(mainCanvas).attr("width", settings.width)
                        .attr("height", settings.height);
                    drawReauthoredWaveform();
                }
            });
            
            console.log("am i here?", settings.width, settings.height);
            drawReauthoredWaveform(settings.width, settings.height);
            if (settings.play) {
                settings.sound.play();
            }
            return this;
        },
        destroy: function () {
            this.html("");
            return this.each(function(){
                $(window).unbind('.tooltip');
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
})(jQuery);