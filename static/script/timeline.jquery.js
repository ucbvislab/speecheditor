// jQuery plugin to show a music timeline with moving (and scrubbable) bar

(function ($) {
    
    var methods = {
        init: function (options) {
            var settings = $.extend({
               'img':  undefined,
               'sound': undefined,
               'play': true,
               'width': this.width(),
               'height': this.height(),
               'barColor': '#000000',
               'barWidth': 3
            }, options),
                duration = settings.sound.duration,
                tmpCanvas,
                mainCanvas,
                tmpCtx,
                mainCtx,
                clearCanvas,
                moveCanvas,
                updateVis,
                scrub,
                updatePlayhead,
                msPerPixel = parseFloat(duration) / parseFloat(settings.width);
        
            console.log("TIMELINE START");
            console.log(settings);
        
            if (settings.img === undefined || settings.sound === undefined) {
                return this;
            }
        
            settings.sound.options.whileloading = function () {
                duration = settings.sound.durationEstimate;
                msPerPixel = parseFloat(duration) / parseFloat(settings.width);
            };
        
            settings.sound.options.onload = function () {
                duration = settings.sound.duration; 
                msPerPixel = parseFloat(duration) / parseFloat(settings.width);
            };
        
            tmpCanvas = document.createElement('canvas');
            $(tmpCanvas).attr("width", settings.width)
                .attr("height", settings.height)
                .css("display", "none");

            mainCanvas = document.createElement('canvas');
            $(mainCanvas).attr("width", settings.width)
                .attr("height", settings.height);

            tmpCtx = tmpCanvas.getContext('2d');
            mainCtx = mainCanvas.getContext('2d');

            this.append(mainCanvas)
                .append(tmpCanvas);
        
            clearCanvas = function (canvas, ctx) {
            	// Store the current transformation matrix
            	ctx.save();

            	// Use the identity matrix while clearing the canvas
            	ctx.setTransform(1, 0, 0, 1, 0, 0);
            	ctx.clearRect(0, 0, canvas.width, canvas.height);

            	// Restore the transform
            	ctx.restore();
            }

            moveCanvas = function (fromCanvas, toCanvas) {
                var toContext = toCanvas.getContext('2d');
                clearCanvas(toCanvas, toContext);
                toContext.drawImage(fromCanvas, 0, 0);
            }
        
            updateVis = function () {
            	clearCanvas(tmpCanvas, tmpCtx);	
            	var waveform = new Image();
            	waveform.onload = function() {
            		tmpCtx.drawImage(waveform, 0, 0);
            		moveCanvas(tmpCanvas, mainCanvas);
            	}
            	waveform.src = settings.img;
            }
        
            scrub = function (event) {
                event = event || window.event;
                var x = event.pageX - mainCanvas.offsetLeft;
                if (x <= 0) x = 0;
                if (settings.sound !== undefined) {
                    settings.sound.setPosition(x * msPerPixel);
                }
                console.log("scrubbed to", x)
                updatePlayhead(x * msPerPixel);
            };

            updatePlayhead = function(pos) {
                // pos is in milliseconds
                moveCanvas(tmpCanvas, mainCanvas);
                mainCtx.fillStyle = settings.barColor;
                mainCtx.fillRect(pos / msPerPixel, 0, 
                    settings.barWidth, settings.height);
            };
        
            settings.sound.options.whileplaying = function () {
     	        updatePlayhead(this.position);
            };
            
            $(mainCanvas).click(scrub);
            
            updateVis();
            if (settings.play) {
                settings.sound.play();
            }
            return this;
        },
        destroy: function () {
            this.html("");
            return this;
        }
    };
    
    $.fn.timeline = function (method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        }
        $.error('Method ' + method + 'does not exist on jQuery.timeline');
    }
})(jQuery);