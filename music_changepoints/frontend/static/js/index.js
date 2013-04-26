var tmpCtx, tmpCanvas;
var resultsCtx = [];
var resultsCanvas = [];
var tmpCanvasArr = [];
var tmpCtxArr = [];
var pixPerSec, sound;

var cpArr = [];

$.ajaxSetup({ cache:false });

soundManager.noSWFCache = true;
soundManager.setup({
  	// path to directory containing SM2 SWF
	url: '/static/swf/',
    onready: function() {
        updateWaveform();
    }
});



$(function() {
    $.getJSON('/songs', function(data) {
        console.log(data)
        for (var d in data.songs) {
            var opt = '<option>' + data.songs[d] + '</option>';
            $('.song-select').append(opt);
        }
        updateWaveform();
    });

    $('.song-select').change(updateWaveform);
    $('.results-canvas').click(scrub);
    $('.ppbtn').click(togglePlay);
    $(document).keyup(function(e) {
        if (e.keyCode == 32) {
             togglePlay();
        }
    });
    

    $( "#slider" ).slider({
        value:.5,
        min: 0,
        max: 1,
        step: .1,
        slide: function( event, ui ) {
            $( ".rmsWeight" ).val( ui.value );
        }
    });
    $( ".rmsWeight" ).val( $( "#slider" ).slider( "value" ) );
    
    tmpCanvas = $('.tmp-canvas')[0];
    tmpCtx = tmpCanvas.getContext('2d');
});

// I hate writing things out like this...
var errorBox =  '<div class="alert alert-error"><button type="button" class="close" data-dismiss="alert">×</button><strong>Error:</strong> <span class="error-box"></span></div>';

var updateWaveform = function() {
    var song = $('.song-select').val();
    $.getJSON('/waveform/' + song, function(data) {
        pixPerSec = 600.0 / data.duration;
        var waveform = new Image();
        waveform.onload = function() {
            tmpCtx.drawImage(waveform, 0, 0, 600, 100);
            
            $('.results .resCanvas').remove();
            var canv = document.createElement('canvas');
            canv.setAttribute('width', 600);
            canv.setAttribute('height', 100);
            canv.setAttribute('class', 'resCanvas');
            $('.results').append(canv);
            
            moveCanvas(tmpCanvas, canv);
        };
        waveform.src = data.waveform;
    })
    
	if (sound !== undefined) {
	    soundManager.destroySound('mySound');
	}
	sound = soundManager.createSound({
	   id: 'mySound',
	   url: '/static/songs/mp3/' + song + '.mp3',
	   autoLoad: true,
	   autoPlay: false,
	   multishot: false,
	   onload: pause,
       onfinish: pause,
	   whileplaying: function() {
	        updatePlayhead(this.position);
	   },
	   volume: 100 
	});
}

var changepoints = function() {
	var song = $('.song-select').val();
	var dist = $('.dist-select').val();
	var feat = $('.feat-select').val();
    
    var nres = parseInt($('.nresults').val());
	var rmsWeight = parseFloat($('.rmsWeight').val());
    
    var k = $('.kernel-size').val();
    var ks = k.split(',');
    for (var i = 0; i < ks.length; i++) {
        ks[i] = parseInt(ks[i]);
    	if (ks[i] !== ks[i]) {
            $('form').prepend(errorBox);
            $('.error-box').text("Each kernel size must be an integer");
    		return;
    	}
        $('.alert-error').remove();
    }
    
    $('.resCanvas').remove();
        
    var spinner = new Spinner().spin($('.spinbox')[0]);
    
    cpArr = [];
    tmpCanvasArr = [];
    tmpCtxArr = [];
    resultsCtx = [];
    resultsCanvas = [];
    
    for (var i = 0; i < ks.length; i++) {
        var k = ks[i];
        cpArr[i] = [];
        
        // create and save new canvas/context
        var tmpCanv = document.createElement("canvas");
        tmpCanv.setAttribute("width", 600);
        tmpCanv.setAttribute("height", 100);
        tmpCanv.setAttribute("class", "resCanvas");
        tmpCanv.setAttribute("style", "display:none");
        tmpCanvasArr.push(tmpCanv);
        $('.results').append(tmpCanv);
        var tmpCanvCtx = tmpCanv.getContext('2d');
        tmpCtxArr.push(tmpCanvCtx);
        
        moveCanvas(tmpCanvas, tmpCanv)
        
        var canv = document.createElement("canvas");
        canv.setAttribute("width", 600);
        canv.setAttribute("height", 100);
        canv.setAttribute("class", "resCanvas");
        canv.onclick = scrub;
        resultsCanvas.push(canv);
        $('.results').append(canv);
        var canvCtx = canv.getContext('2d');
        resultsCtx.push(canvCtx);
        
        var cpCallback = function(k, cv, cvCtx, tcv, tcvCtx, cpArrIdx) {
            return function(data) {
                tcvCtx.font = "14pt Helvetica";
                for (var d in data.changepoints) {
                    if (d < nres) {
                        cpArr[cpArrIdx].push(data.changepoints[d]);
                        tcvCtx.fillStyle = "#3366FF"
                        tcvCtx.fillRect(data.changepoints[d] * pixPerSec,
                            0, 3, 200)
                        tcvCtx.fillStyle = "black"
                        tcvCtx.fillText(d, 
                            data.changepoints[d] * pixPerSec, 20 + 20 * (d % 5));   
                    }
                }
                tcvCtx.fillText('k='+k, 5, 90);
                moveCanvas(tcv, cv);
                spinner.stop();
            }
        } 
        
        var staggered = function(k, i) {
            return function() {
                $.getJSON('/changepoints/' + song + '/' + feat + '/' +
                                  dist + '/' + k + '/' + nres + '/' + rmsWeight,
                                  cpCallback(k, canv, canvCtx, tmpCanv, tmpCanvCtx, i));
            }(k, i);
        }
        
        setTimeout(staggered(k, i), i * 2500);
    }
    

};


// http://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
var clearCanvas = function(canvas, ctx) {
	// Store the current transformation matrix
	ctx.save();

	// Use the identity matrix while clearing the canvas
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Restore the transform
	ctx.restore();
}


var togglePlay = function() {
    if (sound !== undefined) {
        if ($('.ppbtn').hasClass('play')) {
            play();
        } else {
            pause();
        }
    }
};


var play = function() {
    $('.ppbtn').removeClass('play');
    $('.ppbtn').html('<i class="icon-pause"></i>Pause');
    sound.play();
};

var pause = function() {
    $('.ppbtn').addClass('play');
    $('.ppbtn').html('<i class="icon-play"></i>Play');
    sound.pause();   
};



var moveCanvas = function(fromCanvas, toCanvas) {
    var toContext = toCanvas.getContext('2d');
    clearCanvas(toCanvas, toContext);
    toContext.drawImage(fromCanvas, 0, 0);
}

var scrub = function(event) {
    event = event || window.event;
    console.log("SCRUBBING", event);
    // var x = event.pageX - resultsCanvas.offsetLeft;
    var x = event.pageX - event.srcElement.offsetLeft;
    // var y = event.pageY - mainCanvas.offsetTop;
    if (sound !== undefined) {
        console.log("setting sound pos");
        sound.setPosition(x * 1000 / pixPerSec);
    }
    console.log("scrubbed to", x, x * 1000 / pixPerSec);
    updatePlayhead(x * 1000 / pixPerSec);
};

var updatePlayhead = function(pos) {
    lowerBd = pos / 1000 - .05;
    upperBd = pos / 1000 + .1;
    
    // pos is in milliseconds
    for(var i = 0; i < tmpCtxArr.length; i++) {
        moveCanvas(tmpCanvasArr[i], resultsCanvas[i]);
        ctx = resultsCtx[i];
        ctx.fillStyle = "#000000";
        ctx.fillRect(pos / 1000 * pixPerSec, 0, 3, 200);
        
        for (var j = 0; j < cpArr[i].length; j++) {
            if (cpArr[i][j] <= upperBd && cpArr[i][j] >= lowerBd) {
                ctx.fillStyle = "#FF0000";
                ctx.fillRect(0, 0, 20, 20);
                break;
            }
        }
    }
};
