/*jslint browser:true devel:true sloppy:true plusplus:true nomen:true */
/*global soundManager */
/*global $ */
/*global _ */


// requires textinputs.jquery.js, found
// http://code.google.com/p/rangyinputs/wiki/Documentation
var TAAPP = TAAPP || {};

// http://my.opera.com/GreyWyvern/blog/show.dml/1725165
var clone = function (t) {
  var newObj = (t instanceof Array) ? [] : {};
  for (i in t) {
    if (t[i] && typeof t[i] == "object") {
      newObj[i] = clone(t[i]);
    } else newObj[i] = t[i]
  } return newObj;
};

soundManager.setup({
    url: 'swf/soundmanager2_flash9.swf',
    flashVersion: 9,
    useFlashBlock: false,
    useHighPerformance: true
});

TAAPP.state = {
    speechReauthor: {},
    speechSampleRate: 44100,
    timelineHeight: 100,
    timelineWidth: 2000
};

TAAPP.spinner = new Spinner({
    lines: 13, // The number of lines to draw
    length: 26, // The length of each line
    width: 9, // The line thickness
    radius: 35, // The radius of the inner circle
    corners: 1, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    color: '#0f82f5', // #rgb or #rrggbb
    speed: 0.8, // Rounds per second
    trail: 52, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '200px', // Top position relative to parent in px
    left: 'auto' // Left position relative to parent in px
});

TAAPP.bestBreathIndices = function () {
    var bestBreath = _.min(
        _.filter(TAAPP.words, function (word) {
            return (word.hasOwnProperty("breathLen"));
        }),
        function (breath) {
            return breath.breathLen;
    });
    var indices = [bestBreath.origPos];
    if (TAAPP.words[bestBreath.origPos + 1].alignedWord === "sp") {
        indices.push(bestBreath.origPos + 1);
    }
    return indices;
};

TAAPP.randomBreathIndices = function () {
    var breaths = _.filter(TAAPP.words, function (word) {
        return (word.hasOwnProperty("breathLen"));
    });
    var breath = breaths[Math.floor(Math.random()*breaths.length)];
    var indices = [breath.origPos];
    if (TAAPP.words[breath.origPos + 1].alignedWord === "sp") {
        indices.push(breath.origPos + 1);
    }
    return indices;

}

TAAPP.insertBreath = function () {
    var indices = TAAPP.bestBreathIndices();
    TAAPP.TAManager.insertWords(indices);
};

// TODO: fix this to work with the new 2-person layout
TAAPP.globalBreathFill = function () {
    var punc = /[\.:!\?]$/;
    var newBreathInds = [];
    _.each(TAAPP.current, function (word, i, cur) {
        if (punc.exec(word.word) !== null) {
            while (++i < cur.length) {
                if (cur[i].alignedWord === "{BR}") {
                    break;
                }
                if (cur[i].alignedWord !== "gp" &&
                    cur[i].alignedWord !== "sp") {
                    newBreathInds.push(i);
                    break;
                }
            }
        }
    });
    
    var offset = 0;

    _.each(newBreathInds, function(i) {
        var breathInd = TAAPP.randomBreathIndices();
        var words = _.map(breathInd, function (bi) {
            return TAAPP.words[bi];
        });
        var args = [i + offset, 0].concat(words);
        offset += words.length;
        Array.prototype.splice.apply(TAAPP.current, args);
    });

    TAAPP.updateTextArea();
    TAAPP.updatePos();
};

TAAPP.generateAudio = function () {
    TAAPP.state.speechReauthor = { "words": TAAPP.current };
    TAAPP.state.exportedTimeline = TAAPP.$timeline.timeline("export");
    
    console.log("exported timeline", TAAPP.state.exportedTimeline);
    
    TAAPP.spinner.spin($("body")[0]);

    $.ajax({
        url: '../reauthor',
        type: 'POST',
        dataType: 'json',
        contentType: 'json',
        data: JSON.stringify(TAAPP.state),
        success: function (data) {
            if (TAAPP.sound !== undefined) {
                TAAPP.sound.destruct();
            }
            TAAPP.sound = TAAPP.createSound(data);

            TAAPP.spinner.stop();
        },
        error: function (data) {
            TAAPP.spinner.stop();
        }
    });
};

TAAPP.createSound = function (data) {
    return soundManager.createSound({
        id: 'speech',
        url: data.url + "?r=" + parseInt(Math.random() * 10000),
        autoPlay: true,
        autoLoad: true,
        onplay: function () {
            $('.playBtn').html('<i class="icon-pause icon-white"></i>');
        },
        onresume: function () {
            $('.playBtn').html('<i class="icon-pause icon-white"></i>');
        },
        onpause: function () {
            $('.playBtn').html('<i class="icon-play icon-white"></i>');
        },
        onload: function () {
            TAAPP.timing = data.timing
            _.each(data.timing, function (elt, idx, list) {
                var cwTiming = elt * 1000.0;
                this.onPosition(cwTiming, function () {
                    TAAPP.TAManager.highlightWords(idx); 
                });
            }, this);
            var speechEnd = (_.last(data.timing) + 2) * 1000.0;
            this.onPosition(speechEnd, function () {
                TAAPP.TAManager.highlightWords(-1);
            });
            TAAPP.$timeline.timeline({
                sound: this
            });
        },
        onfinish: function () {
            TAAPP.TAManager.highlightWords(-1);
            TAAPP.$timeline.timeline("option", "position", 0.0);
        },
        whileplaying: function (position) {
            TAAPP.$timeline.timeline("option", "position", this.position);
        }
    });
};

TAAPP.adjustHeight = function () {
    var eltHeight = window.innerHeight - $('.dupeList').offset().top - 50;
    $('.dupeList').height(eltHeight);
    TAAPP.TAManager.adjustHeight();
};

// TODO: fix this in wake of new timing data
TAAPP.playFromSelection = function () {
    var sel = TAAPP.ta.getSelection(),
        cur = TAAPP.currentRange(sel.start),
        i,
        startIndex = TAAPP.timing.length - 1;
    console.log(cur);
    console.log(TAAPP.timing);
    for (i = 0; i < TAAPP.timing.length; i++) {
        if (TAAPP.timing[i][0] >= cur[1]) {
            startIndex = i - 1;
            break;
        }
    }
    console.log(TAAPP.timing[startIndex][1] * 1000.0);
    TAAPP.sound.stop();
    TAAPP.sound.setPosition(TAAPP.timing[startIndex][1] * 1000);
    TAAPP.sound.play();
};

TAAPP.roomTone = {
    "sedaris": {
        "start": 32.837, 
        "end": 34.118, 
        "word": "{gpause}",
        "alignedWord": "gp"
    },
    "bullw": {
        "start": 123.0,
        "end": 124.266,
        "word": "{gpause}",
        "alignedWord": "gp"
    },
    "scorerickard": {
        "start": 19.530,
        "end": 19.851,
        "word": "{gpause}",
        "alignedWord": "gp"
    },
    "teleclip": {
        "start": 0.044,
        "end": 0.476,
        "word": "{gpause}",
        "alignedWord": "gp"
    }
};

TAAPP.buildWaveform = function (sound, kind) {
    var wf = document.createElement("div");
    if (kind === "textaligned") {
        console.log("creating text aligned waveform");
        $(wf).textAlignedWaveform({
            dur: sound.duration,
            len: sound.duration,
            filename: sound.url,
            name: "Speech",
            currentWords: TAAPP.current
        });
        TAAPP.currentWaveform = wf;
    } else {
        $(wf).waveform({
            dur: sound.duration,
            len: sound.duration,
            name: sound.id
        });
    }

    console.log("in buildWaveform", wf);
    // get the waveform data
    // from:
    // wav2json -p 2 -s 2000 --channels mid -n FILENAME.wav 
    $.getJSON('wfData/' + TAAPP.speech + '44.wav.json', function (data) {
        $(wf).wf({
            data: data.mid
        });
    });
    return wf;
};

TAAPP.origSoundURL = function () {
    if (TAAPP.env !== undefined) {
        if (TAAPP.env === "production") {
            return "http://d1qv8gm47dmlns.cloudfront.net/mp3s/" +
                TAAPP.speech + ".mp3";
            // return "https://s3.amazonaws.com/speecheditor/mp3s/" +
            //     TAAPP.speech + ".mp3";
        }
    }
    return TAAPP.speech + ".mp3";
};

TAAPP.loadOriginal = function () {
    var args = {
        url: TAAPP.origSoundURL(),
        id: 'orig',
        autoLoad: true,
        onload: function () {
            console.log("loaded original sound");
            
            // initialize timeline
            var wf = TAAPP.buildWaveform(this, "textaligned");
            
            TAAPP.$timeline.timeline({
                tracks: 2,
                pxPerMs: .005,
                width: "100%",
                wf: [{ elt: wf, track: 0, pos: 0.0 }]
            });
            
            TAAPP.adjustHeight();
        },
        autoPlay: false
    };
    if (TAAPP.origSound === undefined) {
        soundManager.onready(function () {
            TAAPP.origSound = soundManager.createSound(args);
        });
    } else {
        TAAPP.origSound.destruct();
        TAAPP.origSound = soundManager.createSound(args);
    }
};

TAAPP.reset = function () {
    TAAPP.state.speechAudio = TAAPP.speech + "44.wav";
    if (TAAPP.sound) {
        TAAPP.sound.destruct();
        TAAPP.sound = undefined;
    }
    TAAPP.current = undefined;
    TAAPP.timing = undefined;
    TAAPP.dupes = undefined;
    TAAPP.currentWaveform = undefined;
    
    // destroy timeline
    try {
        $('.timeline').timeline('destroy');  
    } catch (e) {
        "woop";
    }
    TAAPP.$timeline = $('.timeline');
    
    // reset TextAreaManager
    $(".TAManager").html("");
    TAAPP.TAManager = undefined;
    

    $('.dupeList').html("");
    TAAPP.state.outfile = TAAPP.speech + '-' + TAAPP.outfile;
    $('.dlLink').prop('href', '../download/' + TAAPP.state.outfile);

    // mod for now to do on-the-fly classification of breaths
    $.getJSON('../alignment/' + TAAPP.speech, function (data) {
        var words = data.words;
        // filename of the new json
        TAAPP.state.speechText = data.speechText;
        TAAPP.words = words;
        // keep track of each word's position in TAAPP.words
        _.each(TAAPP.words, function (word, idx) {
           word.origPos = idx; 
        });
        
        TAAPP.current = clone(TAAPP.words);
        
        TAAPP.speakers = _.chain(TAAPP.words)
            .map(function (word) { return word.speaker; })
            .filter(function (word) { return !_.isUndefined(word); })
            .uniq()
            .value();
        TAAPP.TAManager = new TextAreaManager($(".TAManager"),
            TAAPP.speakers, TAAPP.words, TAAPP.current);

        TAAPP.updateDupes();

        // create the orignal sound, for sound "spriting"
        TAAPP.loadOriginal();
    });    
};

TAAPP.updateDupes = function () {
    $.ajax({
        url: '../dupes',
        type: 'POST',
        dataType: 'json',
        contentType: 'json',
        data: JSON.stringify(TAAPP.state),
        success: function (data) {
            TAAPP.dupes = data;
            TAAPP._preprocessDupes();
            TAAPP.drawScript();
            TAAPP.TAManager.insertDupeOverlays(TAAPP.dupes, TAAPP.dupeInfo);
        }
    });
};

TAAPP._preprocessDupes = function () {
    // just do this once to build the necessary data structures for
    // insertDupeOverlays
    var dupeStarts = _.flatten(_.compact(
        _.map(TAAPP.dupes, function (elt, idx, list) {
            if (elt.length !== 1) {
                return _.map(elt, function (e, i) {
                   return {
                       firstWord: e[0][0],
                       dupe: elt,
                       dElt: e,
                       idxInDupes: idx
                   };
                });
            }
            return false;
        })
    ));
    var dupeStartsFirsts = _.pluck(dupeStarts, "firstWord");
    TAAPP.dupeInfo = {
        starts: dupeStarts,
        firsts: dupeStartsFirsts
    };
};

TAAPP.drawScript = function () {
    _.each(TAAPP.dupes, function (elt, idx, list) {
        var play = document.createElement('button'),
            insert = document.createElement('button'),
            div = document.createElement('div');
        $(play).html('<i class="icon-play icon-white"></i>')
            .addClass('btn btn-success')
            .prop("type", "button");
        $(insert).html('<i class="icon-plus icon-white"></i>')
            .addClass('btn btn-primary');
        $(div).addClass('scriptLine');
        
        var lastWord = TAAPP.words[elt[0][0][1]]
        var speaker = "";
        if (lastWord.hasOwnProperty("speaker")) {
            speaker = lastWord.speaker + ": ";
        }
        
        if (elt.length === 1) {
            $(play).click(function () {
                TAAPP.origSound.play({
                    from: 1000.0 * TAAPP.words[elt[0][0][0]].start,
                    to: 1000.0 * TAAPP.words[elt[0][0][1]].end
                });
            });
            $(insert).click(function () {
                var indices = elt[0][0];
                TAAPP.TAManager.insertWords(
                    _.range(indices[0], indices[1] + 1)
                );
            });
            var btnGroup = document.createElement('div');
            $(btnGroup).addClass('btn-group')
                .append(play)
                .append(insert);
            var span = document.createElement('span');
            $(span).text(speaker + elt[0][1])
                .addClass("scriptLineText");
            $(div).append(btnGroup)
                .append(span);
            $('.dupeList').append(div);
            
        } else {
            var opts = _.map(elt, function (e, i) {
                var opt = document.createElement('option');
                $(opt).val(i).text(e[1]);
                return opt;
            }),
                sel = document.createElement('select');
            $(play).click(function () {
                var playIdx = $(sel).val(),
                    indices = elt[playIdx][0],
                    start = TAAPP.words[indices[0]].start,
                    end = TAAPP.words[indices[1]].end;
                TAAPP.origSound.play({
                    from: start * 1000.0,
                    to: end * 1000.0
                });
            });
            $(insert).click(function () {
                var insertIdx = $(sel).val(),
                    indices = elt[insertIdx][0],
                    taSel = TAAPP.ta.getSelection();
                TAAPP.insertWords(
                    _.range(indices[0], indices[1] + 1),
                    taSel.start
                );
            });
            $(sel).append(opts)
                .prop("name", 'dupe' + idx)
                .addClass("span10");
            $(div).addClass("input-prepend")
                .append(play)
                .append(insert)
                .append(sel);
            $('.dupeList').append(div);
        }
    });
    
    TAAPP.adjustHeight();
};

TAAPP.reauthor = function () {
    if (TAAPP.sound) {
        TAAPP.sound.pause();
    }
    TAAPP.TAManager.highlightWords(-1);
    TAAPP.generateAudio();
};

TAAPP.togglePlay = function () {
    if (TAAPP.sound) {
        TAAPP.sound.togglePause();
    } else {
        TAAPP.reauthor();
    }
};

TAAPP._timelineClickMode = "marker";


TAAPP.toggleMode = function (mode) {
    if (mode === "split" && TAAPP._timelineClickMode === "split") {
        TAAPP._timelineClickMode = "marker";
    } else if (mode === "split" && TAAPP._timelineClickMode !== "split") {
        TAAPP._timelineClickMode = "split";
    }
    
    // alert the timeline to respond to clicks appropriately
    TAAPP.$timeline.timeline({
        clickMode: TAAPP._timelineClickMode
    });
}

TAAPP._zoom = function (factor) {
    var currentZoom = TAAPP.$timeline.timeline("option", "pxPerMs");
    TAAPP.$timeline.timeline({
        pxPerMs: currentZoom * factor
    });
};

TAAPP.zoomIn = function () {
    TAAPP._zoom(2);
};

TAAPP.zoomOut = function () {
    TAAPP._zoom(.5);
};

TAAPP.uploadSong = function (form) {
    var formData = new FormData(form);
    
    TAAPP.spinner.spin($("body")[0]);
    
    $.ajax({
        url: '../uploadSong',
        type: 'POST',
        success: function (data) {
            $(form).find('[data-dismiss="fileupload"]').trigger("click");
            var wf = document.createElement('div');
            $(wf).musicWaveform({
                data: data.wfData,
                name: data.name,
                filename: data.path,
                dur: data.dur,
                len: data.dur,
                musicGraph: data.graph
            });
            TAAPP.$timeline.timeline("addWaveform", {elt: wf, track: 1, pos: 0.0});
            console.log(data);
            
            TAAPP.spinner.stop();
            
        },
        error: function (data) {
            TAAPP.spinner.stop();
        },
        data: formData,
        cache: false,
        contentType: false,
        processData: false
    });
    return false;
};

TAAPP.loadSite = function () {
    $("select[name=speechSelect]").change(function() {
        console.log("Changing to " + $(this).val());
        TAAPP.speech = $(this).val();
        TAAPP.reset();
    });
    
    TAAPP.speech = $("select[name=speechSelect]").val();
    TAAPP.outfile = Math.random().toString(36).substring(12);
    TAAPP.reset();
    
    $('.gPause').click(function () {
        var gp = clone(TAAPP.roomTone[TAAPP.speech]);
        gp.pauseLength = parseFloat($('.gpLen').val());
        gp.word = '{gp-' + gp.pauseLength + '}';
        TAAPP.TAManager.insertWords([gp.word])
        return false;
    });
    
    $('.insBreath').click(TAAPP.insertBreath);
    
    $('.genLink').click(TAAPP.reauthor);
    $('.playBtn').click(TAAPP.togglePlay);
    $('.zoomInBtn').click(TAAPP.zoomIn);
    $('.zoomOutBtn').click(TAAPP.zoomOut);
    $('.razorBtn').click(function () {
        $(this).toggleClass("buttonActive");
        TAAPP.toggleMode("split");
    });
    $('#songUploadForm').submit(function () {
        TAAPP.uploadSong($("#songUploadForm")[0]);
        return false;
    });
    
    $("body").keyup(function (e) {
        if (e.keyCode === 80) {
            TAAPP.togglePlay();
        }
    });
    
    $(window).resize(function () {    
        TAAPP.adjustHeight();
        TAAPP.TAManager.insertDupeOverlays(TAAPP.dupes, TAAPP.dupeInfo);
    });

};

$(function () {
    TAAPP.loadSite();
});

