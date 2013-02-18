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

TAAPP.processPaste = function (a, b) {
    var parse_paste = /(?:\[(\d+|gp)\]([^|]+)\|)/g;
    var bRes = false;
    var sel = TAAPP.ta.getSelection();
    var pastedWords = [];
    // don't allow paste in the middle of a word
    if (a.length - b.length + sel.start !== 0 &&
        a.charAt(a.length - b.length + sel.start) !== ' ' &&
        a.charAt(a.length - b.length + sel.start - 1) !== ' ') {
            console.log("Can't insert here (middle of word)!");
            TAAPP.ta.val(a);
            return
    }
    var result;
    while (result = parse_paste.exec(b)) {
        bRes = true;
        if (result[1] === 'gp') {
            pastedWords.push(result[2]);
        } else {
            pastedWords.push(parseInt(result[1]));
        }
    }
    if (bRes) {
        TAAPP.insertWords(pastedWords, a.length - b.length + sel.start);
        return
    }
    TAAPP.ta.val(a);
};

TAAPP.processCopy = function () {
    var selection = window.getSelection();
    var newdiv = document.createElement('div');
    var sel = TAAPP.ta.getSelection();
    var wrds = TAAPP.currentRange(sel.start, sel.end);
    var mod;
    mod = _.reduce(wrds, function(memo, wrd) {
        var j;
        if (wrd.alignedWord === "gp") {
            console.log("copying gp");
            return memo + '[gp]' + wrd.word + '|';
        }
        for (j = 0; j < TAAPP.words.length; j++) {
            if (TAAPP.words[j].start === wrd.start &&
                TAAPP.words[j].end === wrd.end) {
                break;
            }
        }
        return memo + '[' + j + ']' + wrd.word + '|';
    }, "");
    
	newdiv.style.position = 'absolute';
	newdiv.style.left = '-99999px';
	$("body").append(newdiv);
	newdiv.innerHTML = mod;
	selection.selectAllChildren(newdiv);
    _.defer(function () {
        $(newdiv).remove();
    });
};

TAAPP.processCut = function () {
    var sel = TAAPP.ta.getSelection(),
        wrds = TAAPP.currentRange(sel.start, sel.end),
        mod,
        newOut;
    TAAPP.updateText()
    newOut = TAAPP.text;
    mod = _.reduce(wrds, function(memo, wrd) {
        var j;
        for (j = 0; j < TAAPP.words.length; j++) {
            if (TAAPP.words[j].start === wrd.start &&
                TAAPP.words[j].end === wrd.end) {
                break;
            }
        }
        return memo + '[' + j + ']' + wrd.word + '|';
    }, "");
    newOut = newOut.slice(0, sel.start) + mod + newOut.slice(sel.end + 1);
    TAAPP.ta.val(newOut).setSelection(sel.start, sel.start + mod.length);
};

TAAPP.processDelete = function (direction) {
    if (TAAPP.sound) {
        TAAPP.sound.pause();   
    }
    TAAPP.snapSelectionToWord();
    var sel = TAAPP.ta.getSelection(),
        end;
    if (sel.length === 0) {
        TAAPP.selectWord(direction, true);
    }
    sel = TAAPP.ta.getSelection();
    end = sel.end;
    while (TAAPP.text.charAt(end) === ' ') {
        end++;
    }
    TAAPP.pruneCurrentByTAPos(sel.start, end);
    TAAPP.updateTextArea();
    TAAPP.ta.setSelection(sel.start, sel.start);
};

TAAPP.currentRange = function (start, end) {
    if (end === undefined) {
        var i, first;
        for (i = 0; i < TAAPP.current.length; i++) {
            if (TAAPP.current[i].taPos >= start) {
                first = TAAPP.current[i].taPos;
                break;
            }
        }
        return [first, i];
    }
    console.log("currentrange", start, end);
    return _.filter(TAAPP.current, function (word) {
       return word.taPos >= start && word.taPos < end; 
    });
}

TAAPP.pruneCurrent = function (start, end) {
    TAAPP.current.splice(start, end - start);
    TAAPP.updatePos();
}

TAAPP.pruneCurrentByTAPos = function (start, end) {
    var ctx = [];
    _.each(TAAPP.current, function (word, idx) {
         if (word.taPos >= start && word.taPos < end) {
             ctx.push(idx);   
         }
    });
    TAAPP.pruneCurrent(ctx[0], _.last(ctx) + 1);
};

TAAPP.insertWords = function (indices, pos) {
    // find location
    var i,
        words,
        args;
    for (i = 0; i < TAAPP.current.length; i++) {
        if (TAAPP.current[i].taPos >= pos) {
            break;
        }
    }
    // copy words
    var ctx = {
        "first": undefined,
        "last": undefined
    }
    // just in case we're passed a lone index
    if (!_.isArray(indices)) {
        indices = [indices];
    }
    words = _.map(indices, function (idx) {
        if (idx.toString().split('-')[0] === '{gp') {
            var tmp = clone(TAAPP.roomTone[TAAPP.speech]);
            tmp.word = idx;
            tmp.pauseLength = parseFloat(idx.split('-')[1]);
            if (ctx.first === undefined) {
                this.first = tmp;
            }
            this.last = tmp;
            return tmp;
        }
        var tmp = clone(TAAPP.words[idx]);
        if (ctx.first === undefined) {
            this.first = tmp;
        }
        this.last = tmp;
        return tmp;
    }, ctx);
    // insert them
    args = [i, 0].concat(words);
    Array.prototype.splice.apply(TAAPP.current, args);
    TAAPP.updateTextArea();
    TAAPP.updatePos();
    var newStart = ctx.first.taPos;
    var newEnd = ctx.last.taPos + ctx.last.word.length;
    TAAPP.ta.setSelection(newEnd, newEnd);
    return [newStart, newEnd];
};

TAAPP.insertBreath = function () {
    TAAPP.updateText();
    var sel = TAAPP.ta.getSelection();
    var bestBreath = _.min(
        _.filter(TAAPP.words, function (word) {
            return (word.hasOwnProperty("breathLen"));
        }),
        function (breath) {
            return breath.breathLen;
    });
    indices = [bestBreath.origPos];
    if (TAAPP.words[bestBreath.origPos + 1].alignedWord === "sp") {
        indices.push(bestBreath.origPos + 1);
    }
    TAAPP.insertWords(indices, sel.start);
};

TAAPP.selectWord = function (direction) {
    TAAPP.updateText();
    var start = TAAPP.ta[0].selectionStart,
        other;
    if (direction === "backward") {
        other = start - 1;
        while (TAAPP.text.charAt(other) === ' ' &&
                TAAPP.text.charAt(other) !== '') {
            other--;
        }
        TAAPP.ta.setSelection(other, start);
    } else if (direction === "forward") {
        other = start + 2;
        while (TAAPP.text.charAt(other) === ' ' &&
                TAAPP.text.charAt(other) !== '') {
            other++;
        }
        TAAPP.ta.setSelection(start, other);
    }
    TAAPP.snapSelectionToWord();
};

TAAPP.snapSelectionToWord = function () {
    var sel = TAAPP.ta.getSelection(),
        oldLen,
        doneEnd = false,
        doneStart = false;
    if (sel.length === 0) return;        
    TAAPP.updateText();        
    // is it all spaces?
    if (/^\s+$/.exec(sel.text)) {
        TAAPP.ta.collapseSelection();
    }

    if (sel.length > 0) {
        // move start right
        while (TAAPP.text.charAt(sel.start) === ' ') {
            doneStart = true;
            if (sel.start + 1 < sel.end) {
                TAAPP.ta.setSelection(sel.start + 1, sel.end);
                sel = TAAPP.ta.getSelection();
            } else {
                break;
            }
        }
        // move start left
        while (TAAPP.text.charAt(sel.start - 1) !== ' ' &&
                TAAPP.text.charAt(sel.start - 1) !== '' &&
                oldLen !== sel.length && !doneStart) {
                    console.log("in move start left");
            oldLen = sel.length;
            TAAPP.ta.setSelection(sel.start - 1, sel.end);
            sel = TAAPP.ta.getSelection();
        }

        // move end left
        while (TAAPP.text.charAt(sel.end - 1) === ' ') {
            doneEnd = true;
            if (sel.start < sel.end - 1) {
                TAAPP.ta.setSelection(sel.start, sel.end - 1);
                sel = TAAPP.ta.getSelection();
            } else {
                break;
            }
        }
        // move end right
        while (TAAPP.text.charAt(sel.end) !== ' ' &&
                TAAPP.text.charAt(sel.end) !== '' &&
                oldLen !== sel.length && !doneEnd) {
            oldLen = sel.length;
            TAAPP.ta.setSelection(sel.start, sel.end + 1);
            sel = TAAPP.ta.getSelection();
        }
    }
};

TAAPP.updateText = function () {
    TAAPP.text = TAAPP.ta.val();
};

TAAPP.updatePos = function () {
    TAAPP.highlightWords(-1);
    _.each(TAAPP.current, function (elt, i) {
        TAAPP.current[i].taPos = this.total;
        this.total += elt.word.length + 1;
    }, {"total": 0});
    
    // update the waveform in the timeline
    if (TAAPP.currentWaveform !== undefined) {
        $(TAAPP.currentWaveform).textAlignedWaveform({
            currentWords: TAAPP.current
        })
    }
}

TAAPP.generateAudio = function () {
    TAAPP.state.speechReauthor = { "words": TAAPP.current };
    TAAPP.state.exportedTimeline = TAAPP.$timeline.timeline("export");
    
    console.log("exported timeline", TAAPP.state.exportedTimeline);
    
    // loading
    var spinner = document.createElement('img');
    spinner.src = 'img/smallgear.gif';
    $('.spinner').prepend(spinner);

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

            $(spinner).remove();
        },
        error: function (data) {
            $(spinner).remove();
        }
    });
};

TAAPP.createSound = function (data) {
    return soundManager.createSound({
        id: 'speech',
        url: data.url,
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
                    TAAPP.highlightWords(idx); 
                });
            }, this);
            var speechEnd = (_.last(data.timing) + 2) * 1000.0;
            this.onPosition(speechEnd, function () {
                TAAPP.highlightWords(-1);
            });
            TAAPP.$timeline.timeline({
                sound: this
            });
        },
        onfinish: function () {
            TAAPP.highlightWords(-1);
            TAAPP.$timeline.timeline("option", "position", 0.0);
        },
        whileplaying: function (position) {
            TAAPP.$timeline.timeline("option", "position", this.position);
        }
    });
};

TAAPP.emphasizeWords = function () {
    // emphasizes words that have the "emph" attribute in TAAPP.current
    // and notes edits with the "editLocation" class
    var ctx = [-1];
    var emphHTML = _.reduce(TAAPP.current, function (memo, word, idx) {
        var out = word.word;
        if (word.origPos !== undefined && word.origPos - 1 !== this[0]) {
            out = '<span class="editLocation">' + out + "</span>";
        }
        if (word.emph !== undefined && word.emph === true) {
            out = '<span class="emph">' + out + '</span> ';
        }
        this[0] = word.origPos;
        return memo + out + ' ';
    }, "", ctx);
    $(".emphasis").html(emphHTML);  
};

TAAPP.highlightWords = function (start, end) {
    if (start === -1) {
        TAAPP.currentHighlight = undefined;
        $(".highlights").html("");
        return;
    }
    if (TAAPP.currentHighlight !== undefined &&
        TAAPP.currentHighlight[0] > start &&
        TAAPP.currentHighlight[0] < start + 3) {
            return;
    }
    TAAPP.currentHighlight = [start, end];
    var hlHTML = _.reduce(TAAPP.current, function (memo, word, idx) {
        if (idx === start && (idx === end - 1 || end === undefined)) {
            return memo + '<span class="hl">' + word.word + '</span> ';
        }
        if (idx === start) {
            return memo + '<span class="hl">' + word.word + ' ';
        }
        if (idx === end - 1) {
            return memo + word.word + '</span> ';
        }
        return memo + word.word + ' ';
    }, "");
    $(".highlights").html(hlHTML);
};

TAAPP.adjustHeight = function () {
    TAAPP.ta.height("100px");
    var scrHeight = TAAPP.ta.prop("scrollHeight") + 'px';
    
    var eltHeight = window.innerHeight - TAAPP.ta.offset().top - 50;
    
    TAAPP.ta.height(scrHeight);
    $('.highlights').height(scrHeight);
    $('.hlContainer').height(scrHeight);
    $('.emContainer').height(scrHeight);
    $('.emphasis').height(scrHeight);
    $('.overlayContainer').height(scrHeight);
    $('.overlays').height(scrHeight);
    
    // constrain the boxes for scrollbar usage
    $('.contr').height(eltHeight);
    $('.dupeList').height(eltHeight);
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
                tracks: 3,
                pxPerMs: .005,
                width: "100%",
                wf: [{ elt: wf, track: 0, pos: 0 }]
            });
            
            TAAPP.adjustHeight();
            
            // $('.timeline').timeline({
            //     height: TAAPP.state.timelineHeight,
            //     reauthoredWaveform: TAAPP.speech + '.png',
            //     sound: this,
            //     callback: TAAPP.adjustHeight,
            //     current: TAAPP.current,
            //     origSound: this,
            //     origWaveform: TAAPP.speech + '.png',
            //     play: false
            // });
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
    TAAPP.currentHighlight = undefined;
    TAAPP.dupes = undefined;
    TAAPP.currentWaveform = undefined;
    
    // destroy timeline
    try {
        $('.timeline').timeline('destroy');  
    } catch (e) {
        "woop";
    }
    TAAPP.$timeline = $('.timeline');

    $('.dupeList').html("");
    TAAPP.state.outfile = TAAPP.speech + '-' + TAAPP.outfile;
    $('.dlLink').prop('href', '/download/' + TAAPP.state.outfile);

    // mod for now to do on-the-fly classification of breaths
    $.getJSON('/alignment/' + TAAPP.speech, function (data) {
        var words = data.words;
        // filename of the new json
        TAAPP.state.speechText = data.speechText;
        TAAPP.words = words;
        // keep track of each word's position in TAAPP.words
        _.each(TAAPP.words, function (word, idx) {
           word.origPos = idx; 
        });
        TAAPP.current = clone(TAAPP.words);
        TAAPP.updatePos();
        TAAPP.updateTextArea();
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
            TAAPP.insertDupeOverlays();
        }
    });
};

TAAPP.updateTextArea = function () {
    // draw textarea according to TAAPP.current
    TAAPP.ta.val(_.reduce(TAAPP.current, function (memo, word) {
        if (word.alignedWord === "UH" ||
            word.alignedWord === "UM") {
            word.emph = true;
        }
        return memo + word.word + ' ';
    }, ""));
    TAAPP.emphasizeWords();
    TAAPP.insertDupeOverlays();
    TAAPP.adjustHeight();
}

TAAPP.replaceWords = function (c1, c2, w1, w2) {
    // replace words from c1 to c2 in .current
    // with words w1 through w2 in the original words
    console.log("in replace words");
    var pos = TAAPP.current[c1].taPos;
    TAAPP.pruneCurrent(c1, c2 + 1);
    return TAAPP.insertWords(_.range(w1, w2 + 1), pos);
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

TAAPP.insertDupeOverlays = function () {
    console.log("In insertDupeOverlays");
    
    if (TAAPP.dupes === undefined) return;
    var box = $('.overlays');
    var context = {
            dupeOrder: [],
            bounds: []
    };
    var dupeOrder = [];
    var dupeStartsFirsts = TAAPP.dupeInfo.firsts;
    var dupeStarts = TAAPP.dupeInfo.starts;
    var dupeDropdownTemplate = $('#dupeDropdown').html();
    var boxHTML = _.reduce(TAAPP.current, function (memo, word, idx) {
        var dupeIdx = dupeStartsFirsts.indexOf(word.origPos);
        var allIdx;
        var sentenceEnd;
        var d;
        if (dupeIdx !== -1) {
            sentenceEnd = idx;
            d = dupeStarts[dupeIdx];
            allIdx = d.idxInDupes;
            while (sentenceEnd < TAAPP.current.length &&
                   TAAPP.current[sentenceEnd].origPos >= d.dElt[0][0] &&
                   TAAPP.current[sentenceEnd].origPos <= d.dElt[0][1]) {
                       sentenceEnd++;
            }
            context.dupeOrder.push(allIdx);
            context.bounds.push([idx, sentenceEnd - 1]);
            return memo + _.template(dupeDropdownTemplate,
                {word: word.word, dupeIdx: allIdx}) + ' ';
        }
        return memo + word.word + ' ';
    }, "", context);

    box.html(boxHTML);

    // add bootstrap dropdown hook
    // and add event handlers because we were copying the raw html above
    var taWidth = TAAPP.ta.width();
    $('.dropdown-toggle').each(function (i) {
        var pos = $(this).offset(),
            dupe = TAAPP.dupes[context.dupeOrder[i]],
            start = context.bounds[i][0],
            end = context.bounds[i][1];
        $(this).click(function () {
            TAAPP.ta.setSelection(TAAPP.current[start].taPos,
                TAAPP.current[end].taPos + TAAPP.current[end].word.length);
        }).next('.dropdown-menu').css({
            "left": -pos.left + 30 + "px",
            "width": taWidth - 20 + "px"
        }).find('a.dupeOpt').each(function (j) {
            var $this = $(this);
            $this.click(function (event) {
                var newPos = TAAPP.replaceWords(start, end,
                    dupe[j][0][0], dupe[j][0][1]);
                TAAPP.ta.setSelection(newPos[0], newPos[1]);
                return false;
            }).find('.dupePlayButton').click(function (event) {
                var start = TAAPP.words[dupe[j][0][0]].start;
                var end = TAAPP.words[dupe[j][0][1]].end;
                TAAPP.origSound.play({
                    from: start * 1000.0,
                    to: end * 1000.0,
                    onstop: function () {
                        TAAPP.ta.focus();
                    }
                });
                event.stopPropagation();
            });
        });
    }).dropdown();
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
        if (elt.length === 1) {
            $(play).click(function () {
                TAAPP.origSound.play({
                    from: 1000.0 * TAAPP.words[elt[0][0][0]].start,
                    to: 1000.0 * TAAPP.words[elt[0][0][1]].end
                });
            });
            $(insert).click(function () {
                var indices = elt[0][0],
                    taSel = TAAPP.ta.getSelection();
                TAAPP.insertWords(
                    _.range(indices[0], indices[1] + 1),
                    taSel.start
                );
            });
            var btnGroup = document.createElement('div');
            $(btnGroup).addClass('btn-group')
                .append(play)
                .append(insert);
            var span = document.createElement('span');
            $(span).text(elt[0][1])
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
};

TAAPP.reauthor = function () {
    if (TAAPP.sound) {
        TAAPP.sound.pause();
    }
    TAAPP.highlightWords(-1);
    TAAPP.generateAudio();
};

TAAPP.togglePlay = function () {
    if (TAAPP.sound) {
        TAAPP.sound.togglePause();
    } else {
        TAAPP.reauthor();
    }
};

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
    $.ajax({
        url: '/uploadSong',
        type: 'POST',
        success: function (data) {
            $(form).find('[data-dismiss="fileupload"]').trigger("click");
            var wf = document.createElement('div');
            $(wf).waveform({
                data: data.wfData,
                name: data.name,
                filename: data.path,
                dur: data.dur,
                len: data.dur
            });
            TAAPP.$timeline.timeline("addWaveform", {elt: wf, track: 1, pos: 0});
            console.log(data);
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
        TAAPP.updateText();
        var txt = TAAPP.text;
        var gp = clone(TAAPP.roomTone[TAAPP.speech]);
        var sel = TAAPP.ta.getSelection();
        gp.pauseLength = parseFloat($('.gpLen').val());
        gp.word = '{gp-' + gp.pauseLength + '}';
        TAAPP.insertWords([gp.word], sel.start)
        // TAAPP.current.push(gp);
        // TAAPP.ta.val(txt + gp.word + ' ');
        // TAAPP.updatePos();
        return false;
    });
    
    $('.insBreath').click(TAAPP.insertBreath);
    
    TAAPP.ta = $("#txtArea");
    TAAPP.updateText();
    TAAPP.ta.bind('copy', function (e) {
        console.log('copy', e);
        TAAPP.processCopy();
    }).bind('cut', function (e) {
        console.log('cut', e);
        TAAPP.processCut();
    }).bind('paste', function (e) {
        TAAPP.text = TAAPP.ta.val();
        _.defer(function () {
            var res = TAAPP.processPaste(TAAPP.text, TAAPP.ta.val());
            // TAAPP.ta.val(res[0]);
            // TAAPP.ta.setSelection(res[1], res[1]);
            TAAPP.updateText();
            TAAPP.adjustHeight();
        });
    }).keypress(function (e) {
        if (e.which >= 0x20) {
            e.preventDefault();
        }
    }).keydown(function (e) {
        if (e.which === 8) {
            TAAPP.processDelete("backward");
            return false;
        } else if (e.which === 46) {
            TAAPP.processDelete("forward");
            return false;
        } else if ([37, 38, 39, 40].indexOf(e.which) !== -1) {
            // TODO: fix this later to allow better shift-based text selection
            if (e.shiftKey) {
                _.defer(TAAPP.snapSelectionToWord);
            }
            return true;
        } else if (e.which === 13) {
            TAAPP.reauthor();
            return false;
        } else if (e.which === 90) {
            // prevent undo for now
            return false;
        } else if (e.which === 32) {
            if (TAAPP.sound) {
                TAAPP.playFromSelection();
            }
            return true;
        }
    }).bind('mouseup', TAAPP.snapSelectionToWord);
    
    $('.genLink').click(TAAPP.reauthor);
    $('.playBtn').click(TAAPP.togglePlay);
    $('.zoomInBtn').click(TAAPP.zoomIn);
    $('.zoomOutBtn').click(TAAPP.zoomOut);
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
        TAAPP.insertDupeOverlays();
    });

};

$(function () {
    TAAPP.loadSite();
});

