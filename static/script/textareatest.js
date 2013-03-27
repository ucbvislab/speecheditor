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
    url: 'static/swf/soundmanager2_flash9.swf',
    flashVersion: 9,
    useFlashBlock: false,
    flashLoadTimeout: 15000,
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

TAAPP.allBreathIndices = function () {
    var breaths = _.filter(TAAPP.words, function(word) {
        return word.alignedWord === "{BR}";
        // return (word.hasOwnProperty("breathLen"));
    });
    
    var out = [];
    var i;
    var tmpArr = [];
    for (i = 0; i < breaths.length; i++) {
        tmpArr = [breaths[i].origPos]
        if (breaths[i].origPos + 1 < TAAPP.words.length &&
            TAAPP.words[breaths[i].origPos + 1].alignedWord === "sp") {

            tmpArr.push(tmpArr[0] + 1);

        }
        if (breaths[i].origPos - 1 >= 0 &&
            TAAPP.words[breaths[i].origPos - 1].alignedWord === "sp") {
            
            tmpArr.splice(0, 0, breaths[i].origPos - 1);

        }
        out.push(tmpArr);
        tmpArr = [];
    }
    return out;
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

};

TAAPP._createBreathDropdown = function () {
    var breaths = TAAPP.allBreathIndices();
    var bTemp = _.template($("#breathDropdownTemplate").html());
    
    $('.breathDropdown').append(bTemp({breaths: breaths}))
    .find('.breathPlayButton')
    .each(function (i) {
        $(this).click(function (event) {
            var audiostart = TAAPP.words[breaths[i][0]].start;
            var audioend = TAAPP.words[_.last(breaths[i])].end;
            TAAPP.origSound.play({
                from: audiostart * 1000.0,
                to: audioend * 1000.0
            });
            event.stopPropagation()
        });
    })
    
    $('.breathDropdown').find('.copyButton')
    .each(function (i) {
        $(this).click(function (event) {
            TAAPP.TAManager.insertWords(breaths[i]);
        });
    });
    
};

TAAPP.insertBreath = function () {
    var indices = TAAPP.randomBreathIndices();
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
        url: 'reauthor',
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
    var eltHeight = window.innerHeight - $('#editorRow').offset().top - 50;
    // var eltHeight = window.innerHeight - $('.dupeList').offset().top - 50;

    // $('.dupeList').height(eltHeight - 70 + "px");
    // $('.rawTAManager').height(eltHeight - 70 + "px");
    
    TAAPP.TAManager.adjustHeight();

    
    if (TAAPP.hasOwnProperty("sliders")) {
        TAAPP.sliders.each(function () {
           $(this).tabSlideOut("refresh");
        });
    }
    

    TAAPP.RawTAManager.adjustHeight();
    
    
    if (TAAPP.hasOwnProperty("sliders")) {
        TAAPP.sliders.each(function () {
           $(this).tabSlideOut("refresh");
        });
    }
    
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
        "start": 0.000,
        "end": 0.557,
        "word": "{gpause}",
        "alignedWord": "gp"
    },
    "bluesmobile": {
        "start": 333.334,
        "end": 334.249,
        "word": "{gpause}",
        "alignedWord": "gp"
    },
    "photoshop": {
        "start": 747.588,
        "end": 748.000,
        "word": "{gpause}",
        "alignedWord": "gp"
    },
    "obama": {
        "start": 996.424,
        "end": 1001.143,
        "word": "{gpause}",
        "alignedWord": "gp"
    }
};

TAAPP.underlayWizard = function (wordIndex) {

    var eptContext = function (wordIndex) {
        var word = TAAPP.current[wordIndex];
        var numWords = wordIndex < 7 ? wordIndex : 7;
        var numWordsAfter = TAAPP.current - wordIndex < 7 ? TAAPP.current - wordIndex : 7;
        var wordList = TAAPP.current.slice(wordIndex - numWords, wordIndex + 1);
        var wordListBefore = _.reduce(wordList, function (memo, word) {
            return memo += ' ' + word.word;
        }, "");
        var wordList2 = TAAPP.current.slice(wordIndex + 1, wordIndex + numWordsAfter + 1);
        var wordListAfter = _.reduce(wordList2, function (memo, word) {
            return memo += ' ' + word.word;
        }, "");
        return [wordListBefore, wordListAfter];
    };

    var wlists = eptContext(wordIndex);

    $('#underlayModal .ePt1ModalMarker').data("wordIndex", wordIndex);
    $('#underlayModal .underlayWordsBefore').text(wlists[0]);
    $('#underlayModal .underlayWordsAfter').text(wlists[1]);

    // seconds emphasis point?
    $("#underlayE2Select").html('<option value=""></option>');
    var nextWords = TAAPP.current.slice(wordIndex + 1);
    _.each(nextWords, function (w, i) {
        if (w.hasOwnProperty("emphasisPoint") && w.emphasisPoint) {
            var idx = i + wordIndex + 1;
            var wlists = eptContext(idx);
            var opt = document.createElement('option');
            $(opt).val(idx)
                .html('<i>...' +
                      wlists[0] +
                      ' <span class="ePtModalMarker">*</span> ' +
                      wlists[1] +
                      '...</i>')
                .appendTo("#underlayE2Select");
        }
    });

    $("#underlayE2Select").trigger("liszt:updated");
    $("#underlayE2Select").chosen({allow_single_deselect:true});
    $('#underlayModal').modal("show");
};

TAAPP.createUnderlay = function (wordIndex, songName, wordIndex2) {
    var speechLength = _.reduce(TAAPP.current.slice(0, wordIndex + 1),
        function (memo, word) {
            return memo + word.end - word.start
        }, 0.0);

    // once we have the changepoints...
    var _build = function (cp) {
        var padding = 500;  // in milliseconds
        var best = cp[0];
        var bestms = best * 1000.0 - padding;
        var songData = TAAPP.songInfo[songName];

        var start = bestms - 15 * 1000.0;

        if (speechLength < 15) {
            start += (15 - speechLength) * 1000.0;
        }
        if (start < 0) {
            start = 0.0;
        }

        var end = bestms + (6 + 12 + 3) * 1000.0;
        if (end > songData.dur) {
            end = songData.dur;
        }

        // volume
        var vx = [0, 3000.,
                  bestms - start - 500, bestms - start + 500,
                  bestms - start + 5750, bestms - start + 6500,
                  end - start - 3500, end - start - 500];
        var vy = [0, .15,
                  .15, .75,
                  .75, .15,
                  .15, 0];

        var wf = document.createElement('div');
        $(wf).musicWaveform({
            data: songData.wfData,
            name: songData.name,
            filename: songData.path,
            dur: songData.dur,
            len: end - start,
            start: start,
            musicGraph: songData.graph,
            volume: {
                x: vx,
                y: vy
            }
        });
        TAAPP.$timeline.timeline("addWaveform", {
            elt: wf,
            track: 1,
            pos: speechLength * 1000.0 + start - bestms
        });
    };

    var _buildMulti = function (d) {
        // add the pauses in the speech
        var word1 = TAAPP.current[wordIndex];
        var ta1 = TAAPP.TAManager.tas[word1.taIdx];
        var pos1 = TAAPP.current[wordIndex + 1].taPos;
        var word2, ta2, pos2;

        TAAPP.TAManager.insertWords(['{gp-' + d.solo1 + '}'], pos1, ta1);

        word2 = TAAPP.current[wordIndex2 + 1];
        ta2 = TAAPP.TAManager.tas[word2.taIdx];
        pos2 = TAAPP.current[wordIndex2 + 2].taPos;
        TAAPP.TAManager.insertWords(['{gp-' + d.solo2 + '}'], pos2, ta2);

        if (d.before > 0) {
             var vx = _.map([
                0,
                3,
                d.before - 1,
                d.before,
                d.before + d.solo1 - 1.5,
                d.before + d.solo1 - .5,
                d.before + d.solo1 + d.middle - 1,
                d.before + d.solo1 + d.middle,
                d.before + d.solo1 + d.middle + d.solo2 - 1.5,
                d.before + d.solo1 + d.middle + d.solo2 - .5,
                d.total - 3.5,
                d.total - .5
            ], function (v) { return v * 1000.0; });

            var vy = [
                0,
                .15,
                .15,
                .75,
                .75,
                .15,
                .15,
                .75,
                .75,
                .15,
                .15,
                0
            ];
        } else {
            var vx = _.map([
                0,
                d.solo1 - 1.5,
                d.solo1 - .5,
                d.solo1 + d.middle - 1,
                d.solo1 + d.middle,
                d.solo1 + d.middle + d.solo2 - 1.5,
                d.solo1 + d.middle + d.solo2 - .5,
                d.total - 3.5,
                d.total - .5
            ], function (v) { return v * 1000.0; });

            var vy = [
                .75,
                .75,
                .15,
                .15,
                .75,
                .75,
                .15,
                .15,
                0
            ];
        }

        // create the waveform
        var songData = TAAPP.songInfo[songName];
        var wf = document.createElement('div');
        $(wf).musicWaveform({
            data: songData.wfData,
            name: songData.name,
            filename: songData.path,
            dur: songData.dur,
            len: d.total * 1000.0,
            currentBeats: d.beats,
            musicGraph: songData.graph,
            volume: { x: vx, y: vy }
        });

        TAAPP.$timeline.timeline("addWaveform", {
            elt: wf,
            track: 1,
            pos: (speechLength - d.before + .5) * 1000.0
        });
    }

    TAAPP.spinner.spin($("body")[0]);

    if (wordIndex2 === undefined) {
        if (TAAPP.songInfo[songName].hasOwnProperty("changepoints")) {
            _build(songInfo[songName].changepoints);
            TAAPP.spinner.stop();
        } else {
            $.getJSON('changepoints/' + songName, function (data) {
                TAAPP.songInfo[songName].changepoints = data.changepoints;
                _build(data.changepoints);
                TAAPP.spinner.stop();
            })
        }

        var word = TAAPP.current[wordIndex];
        var ta = TAAPP.TAManager.tas[word.taIdx];
        var pos = TAAPP.current[wordIndex + 1].taPos;

        TAAPP.TAManager.insertWords(['{gp-6}'], pos, ta);
    } else {
        // create retargeted underlay
        var wordsBetween = TAAPP.current.slice(wordIndex + 1, wordIndex2 + 1);

        // get rid of pauses and breaths right after the emphasis point
        var removedPauseOffset = 0;
        while (wordsBetween[0].alignedWord === "sp" ||
               wordsBetween[0].alignedWord === "{BR}" ||
               wordsBetween[0].alignedWord === "gp") {
            removedPauseOffset += 1;
            var removed = wordsBetween.splice(0, 1)[0];
            var ta = TAAPP.TAManager.tas[removed.taIdx];
            TAAPP.TAManager.pruneCurrent(
                wordIndex + 1, wordIndex + 2, ta, false);
        }

        // update wordIndex2 to reflect removed pauses and breaths
        wordIndex2 -= removedPauseOffset;

        // and remove pauses and breaths right after the 2nd emph pt
        var wordsAfter = TAAPP.current.slice(wordIndex2 + 1)
        while (wordsAfter[0].alignedWord === "sp" ||
               wordsAfter[0].alignedWord === "{BR}" ||
               wordsAfter[0].alignedWord === "gp") {

            var removed = wordsAfter.splice(0, 1)[0];
            var ta = TAAPP.TAManager.tas[removed.taIdx];
            TAAPP.TAManager.pruneCurrent(
                wordIndex2 + 1, wordIndex2 + 2, ta, false);
        }

        if (removedPauseOffset > 0) {
            TAAPP.TAManager.refresh();
        }


        var retargetLength = _.reduce(wordsBetween, function (memo, w) {
            return memo + w.end - w.start;
        }, 0.0);

        var before = 15.5;
        if (speechLength < before) {
            before = speechLength;
        }

        $.getJSON('underlayRetarget/' + songName + '/' + retargetLength +
            '/' + before + '/15.0',
            function (data) {
                _buildMulti(data);
                TAAPP.spinner.stop();
            });
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
            currentWords: TAAPP.current,
            emphasisPointFunc: TAAPP.underlayWizard
        });
        TAAPP.currentWaveform = wf;
        
        TAAPP.TAManager.textAlignedWf = TAAPP.currentWaveform;
        
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
    $.getJSON('static/wfData/' + TAAPP.speech + '44.wav.json', function (data) {
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
    return 'static/' + TAAPP.speech + ".mp3";
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
            
            console.log("calling adjust height after timeline creation");
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
    
    $(".rawTAManager").html("");
    TAAPP.RawTAManager = undefined;
    
    $('.breathDropdown').html("");
    
    $('.dupeList').html("");
    TAAPP.state.outfile = TAAPP.speech + '-' + TAAPP.outfile;
    $('.dlLink').prop('href', 'download/' + TAAPP.state.outfile);

    // mod for now to do on-the-fly classification of breaths
    $.getJSON('alignment/' + TAAPP.speech, function (data) {
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
        TAAPP._createBreathDropdown();
        // create the orignal sound, for sound "spriting"
        TAAPP.loadOriginal();
    });
};

TAAPP.updateDupes = function () {
    $.ajax({
        url: 'dupes',
        type: 'POST',
        dataType: 'json',
        contentType: 'json',
        data: JSON.stringify(TAAPP.state),
        success: function (data) {
            TAAPP.dupes = data;
            TAAPP._preprocessDupes();
            
            // TAAPP.drawScript();
            
            TAAPP.RawTAManager = new TextAreaManager($(".rawTAManager"),
                TAAPP.speakers, TAAPP.words, clone(TAAPP.current));
            
            TAAPP.TAManager.insertDupeOverlays(TAAPP.dupes, TAAPP.dupeInfo);
            TAAPP.RawTAManager.insertDupeOverlays(TAAPP.dupes, TAAPP.dupeInfo);
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
                var insertIdx = $(sel).val();
                var indices = elt[insertIdx][0];
                TAAPP.TAManager.insertWords(
                    _.range(indices[0], indices[1] + 1)
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

TAAPP.songInfo = {};

TAAPP.addSongToTimeline = function (songName) {
    var songData = TAAPP.songInfo[songName];
    var wf = document.createElement('div');
    $(wf).musicWaveform({
        data: songData.wfData,
        name: songData.name,
        filename: songData.path,
        dur: songData.dur,
        len: songData.dur,
        musicGraph: songData.graph
    });
    TAAPP.$timeline.timeline("addWaveform", {elt: wf, track: 1, pos: 0.0});
};

TAAPP.addSongToLibrary = function (songData) {
    var songTemplate = $("#songLibraryTemplate").html();
    TAAPP.songInfo[songData.name] = songData;
    $(_.template(songTemplate, {
        name: songData.name,
        title: songData.title,
        artist: songData.artist
    }))
    .appendTo(".musicLibrary table")
    .find('button')
    .click(function () {
        TAAPP.addSongToTimeline($(this).attr("data-song-name"));
    });

    // add the song to the list in the underlay creation modal
    var underlaySongTemplate = $("#underlaySongTemplate").html();
    $(_.template(underlaySongTemplate, {
        name: songData.name,
        title: songData.title,
        artist: songData.artist
    }))
    .appendTo("#underlaySongSelect");
}

TAAPP.uploadSong = function (form) {
    var formData = new FormData(form);
    
    TAAPP.spinner.spin($("body")[0]);
    
    $.ajax({
        url: 'uploadSong',
        type: 'POST',
        success: function (data) {
            $(form).find('[data-dismiss="fileupload"]').trigger("click");
            
            TAAPP.addSongToLibrary(data);            
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
    $("#underlayE2Select").chosen({
        allow_single_deselect: true
    });
    $('.gPause').click(function () {
        var gp = clone(TAAPP.roomTone[TAAPP.speech]);
        gp.pauseLength = parseFloat($('.gpLen').val());
        gp.word = '{gp-' + gp.pauseLength + '}';
        TAAPP.TAManager.insertWords([gp.word])
        return false;
    });
    
    TAAPP.outfile = Math.random().toString(36).substring(12);
    
    // this is now covered by a breath-selection dropdown
    // $('.insBreath').click(TAAPP.insertBreath);
    
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
    $('.clearWords').click(function () {
        TAAPP.TAManager.pruneAll();
    });

    $('.emphPt').click(function () {
        TAAPP.TAManager.insertEmphasisPoint();
    });
    
    $('.createUnderlayBtn').click(function () {
        var wordIndex = $('.ePt1ModalMarker').data('wordIndex');
        var songName = $('input[name=underlaySongRadio]:checked').val();

        var ept2wordIndex = $("#underlayE2Select").val();
        if (ept2wordIndex === "") {
            TAAPP.createUnderlay(wordIndex, songName);
        } else {
            TAAPP.createUnderlay(wordIndex, songName,
                parseFloat(ept2wordIndex, 10));
        }
        
    });

    $(window).resize(function () {    
        TAAPP.adjustHeight();
        TAAPP.TAManager.insertDupeOverlays(TAAPP.dupes, TAAPP.dupeInfo);
    });

    $('body').keydown(function (e) {
        if (e.which === 32) {
            TAAPP.togglePlay();
        } else if (e.which === 13) {
            TAAPP.reauthor();
        }
    });
    
    var outerBox = $('#editorRow');

    TAAPP.sliders = $('.tabSlider');

    $('.origSlider').tabSlideOut({
        tabHandle: '.origSliderHandle',
        tabLocation: 'right',
        speed: 300,
        action: 'click',
        topPos: '0px',
        leftPos: '20px',
        pathToTabImage: 'static/img/origSlider.png',
        imageHeight: '200px',
        imageWidth: '20px',
        height: function () {
            return $('#editorRow').height();
        },
        topReferenceElement: $("#editorRow")
    });

    $('.browserSlider').tabSlideOut({
        tabHandle: '.browserSliderHandle',
        tabLocation: 'right',
        speed: 300,
        action: 'click',
        topPos: '220px',
        leftPos: '20px',
        pathToTabImage: 'static/img/musicBrowserSlider.png',
        imageHeight: '200px',
        imageWidth: '20px',
        topReferenceElement: $("#editorRow"),
        height: function (o) {
            return $('#editorRow').height();
        }
    });
};

TAAPP.newProject = function (speech) {
    if (speech === undefined) {
        TAAPP.speech = $("select[name=speechSelect]").val();
        history.pushState({ speech: TAAPP.speech }, null, "?speech=" + TAAPP.speech);
    } else {
        TAAPP.speech = speech;
    }
    TAAPP.reset();
};

window.onpopstate = function (event) {
    if (event.state == null) {
        return;
    }

    TAAPP.speech = event.state.speech;
    if (TAAPP.speech === "") {
        // show project creation modal
        $("#setupModal").modal("show");
    } else {
        $("#setupModal").modal("hide");
        TAAPP.reset();
    }
}

function getParameterByName(name)
{
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);
    if(results == null)
       return "";
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "));
}

$(function () {
    // make the "create" button work and show the modal
    var speech = getParameterByName("speech");

    // initial state
    history.replaceState({ speech: speech }, null, null);

    $('#setupModal')
    .modal({
        show: (speech === "")
    })
    .find('.createProjectBtn')
    .click(function () {
        TAAPP.newProject();
    });

    if (speech !== "") {
        TAAPP.newProject(speech);
    }

    // initialize everything that doesn't depend on the speech track
    TAAPP.loadSite();
});

