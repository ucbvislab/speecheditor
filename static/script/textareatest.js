/*jslint browser:true devel:true sloppy:true plusplus:true nomen:true */
/*global soundManager */
/*global $ */
/*global _ */


// requires textinputs.jquery.js, found
// http://code.google.com/p/rangyinputs/wiki/Documentation
var TAAPP = {};

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
    useFlashBlock: false
});

TAAPP.state = {
    speechReauthor: {},
    speechSampleRate: 44100,
    timelineHeight: 100,
    timelineWidth: 2000
};

TAAPP.processPaste = function (a, b) {
    var parse_paste = /(?:\[(\d+|gp)\]([^|]+)\|)/g,
        bRes = false,
        sel = TAAPP.ta.getSelection(),
        pastedWords = [];
    // don't allow paste in the middle of a word
    if (a.length - b.length + sel.start !== 0 &&
        a.charAt(a.length - b.length + sel.start) !== ' ' &&
        a.charAt(a.length - b.length + sel.start - 1) !== ' ') {
            console.log("Can't insert here (middle of word)!");
            TAAPP.ta.val(a);
            return
    }
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
    var selection = window.getSelection(),
        newdiv = document.createElement('div'),
        sel = TAAPP.ta.getSelection(),
        wrds = TAAPP.currentRange(sel.start, sel.end),
        mod;
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
    TAAPP.ta.setSelection(sel.start, end);
    TAAPP.pruneCurrent(sel.start, end);
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
    TAAPP.current = _.filter(TAAPP.current, function (word) {
        return word.taPos < start || word.taPos >= end;
    });
    TAAPP.updatePos();
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

// TAAPP.cleanTextArea = function () {
//     var start = TAAPP.ta[0].selectionStart,
//         a = start,
//         b = start;
//     TAAPP.updateText();
//     
//     // spaces to the left
//     while (TAAPP.text.charAt(a - 1) === ' ') {
//         a--;
//     }
//     // spaces to the right
//     while (TAAPP.text.charAt(b) === ' ') {
//         b++;
//     }
//     
//     TAAPP.ta.val(TAAPP.text.slice(0, a + 1) + TAAPP.text.slice(b));
//     TAAPP.ta[0].setSelectionRange(a,a)
// }

TAAPP.snapSelectionToWord = function () {
    TAAPP.updateText();
    var sel = TAAPP.ta.getSelection(),
        oldLen,
        doneEnd = false,
        doneStart = false;

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
    // and redraw emphasis
    TAAPP.emphasizeWords();
};

TAAPP.updatePos = function () {
    TAAPP.highlightWords(-1);
    _.each(TAAPP.current, function (elt, i) {
        TAAPP.current[i].taPos = this.total;
        this.total += elt.word.length + 1;
    }, {"total": 0});
}

TAAPP.generateAudio = function () {
    TAAPP.state.speechReauthor = { "words": TAAPP.current };
    
    // loading
    var spinner = document.createElement('img');
    spinner.src = 'img/spin.gif';
    $('.hlContainer').prepend(spinner);
    $(spinner).css('position', 'absolute')
        .css('left', '436px')
        .css('top', '200px');

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
        autoPlay: false,
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
            _.each(data.timing, function (elt, idx, list) {
                var cwTiming = elt * 1000.0;
                TAAPP.timing = data.timing
                this.onPosition(cwTiming, function () {
                    TAAPP.highlightWords(idx); 
                });
                
            }, this);

            $('.timeline').timeline('destroy')
                .timeline({
                    height: TAAPP.state.timelineHeight,
                    img: data.img,
                    sound: this,
                    callback: TAAPP.adjustHeight
            });
        },
        onfinish: function () {
            TAAPP.highlightWords(-1);
        }
    });
};

TAAPP.emphasizeWords = function () {
    // emphasizes words that have the "emph" attribute in TAAPP.current
    var emphHTML = _.reduce(TAAPP.current, function (memo, word, idx) {
        if (word.emph !== undefined && word.emph === true) {
            return memo + '<span class="emph">' + word.word + '</span> ';
        }
        return memo + word.word + ' ';
    }, "");
    $(".emphasis").html(emphHTML);  
};

TAAPP.highlightWords = function (start, end) {
    TAAPP.updateText();
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

TAAPP.loadOriginal = function () {
    var args = {
        url: TAAPP.speech + '.mp3',
        id: 'orig',
        onLoad: function () {
            console.log("loaded original sound");
        },
        autoPlay: false,
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
    TAAPP.state.speechText = TAAPP.speech + ".json";
    TAAPP.state.speechAudio = TAAPP.speech + "44.wav";
    if (TAAPP.sound) {
        TAAPP.sound.destruct();
        TAAPP.sound = undefined;
    }
    TAAPP.current = undefined;
    TAAPP.timing = undefined;
    TAAPP.currentHighlight = undefined;
    TAAPP.dupes = undefined;
    $('.timeline').timeline('destroy');
    $('.dupeList').html("");
    TAAPP.state.outfile = TAAPP.speech + '-' + TAAPP.outfile;
    $('.dlLink').prop('href', '/download/' + TAAPP.state.outfile);
    
    // create the orignal sound, for sound "spriting"
    TAAPP.loadOriginal();

    $.getJSON(TAAPP.state.speechText, function (data) {
        var words = data.words;
        TAAPP.words = words;
        TAAPP.current = clone(TAAPP.words);
        TAAPP.updatePos();
        TAAPP.updateTextArea();
        TAAPP.updateDupes();
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
            TAAPP.drawScript();
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
    TAAPP.adjustHeight();
}

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

TAAPP.loadSite = function () {
    $('select[name=speechSelect]').change(function() {
        console.log("Changing to " + $(this).val());
        TAAPP.speech = $(this).val();
        TAAPP.reset();
    });
    
    TAAPP.speech = $('select[name=speechSelect]').val();
    TAAPP.outfile = Math.random().toString(36).substring(12);
    TAAPP.reset();
    
    $('.gPause').click(function () {
        TAAPP.updateText();
        var txt = TAAPP.text;
        var gp = clone(TAAPP.roomTone[TAAPP.speech]);
        var sel = TAAPP.ta.getSelection();
        gp.word = '{gp-' + parseFloat($('.gpLen').val()) + '}';
        gp.pauseLength = parseFloat($('.gpLen').val());
        TAAPP.insertWords([gp.word], sel.start)
        // TAAPP.current.push(gp);
        // TAAPP.ta.val(txt + gp.word + ' ');
        // TAAPP.updatePos();
        return false;
    })
    
    TAAPP.ta = $("#txtArea");
    TAAPP.updateText();
    $("#txtArea").bind('copy', function (e) {
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
            // _.defer(TAAPP.cleanTextArea);
        } else if (e.which === 46) {
            TAAPP.processDelete("forward");
            // _.defer(TAAPP.cleanTextArea);
        } else if ([37, 38, 39, 40].indexOf(e.which) !== -1) {
            // TODO: fix this later to allow better shift-based text selection
            _.defer(TAAPP.snapSelectionToWord);
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
        }

    }).bind('mouseup', TAAPP.snapSelectionToWord);
    
    $('.genLink').click(TAAPP.reauthor);
    $('.playBtn').click(TAAPP.togglePlay);
    
    $("body").keyup(function (e) {
        if (e.keyCode === 80) {
            TAAPP.togglePlay();
        }
    });
    
    $(window).resize(function () {
        TAAPP.adjustHeight();
    });
    
};

$(function () {
    TAAPP.loadSite();
});

