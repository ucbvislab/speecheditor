/*jslint browser:true devel:true sloppy:true plusplus:true nomen:true */
/*global soundManager */
/*global $ */
/*global _ */


// requires textinputs.jquery.js, found
// http://code.google.com/p/rangyinputs/wiki/Documentation
var TAAPP = {};

// http://my.opera.com/GreyWyvern/blog/show.dml/1725165
Object.prototype.clone = function() {
  var newObj = (this instanceof Array) ? [] : {};
  for (i in this) {
    if (i == 'clone') continue;
    if (this[i] && typeof this[i] == "object") {
      newObj[i] = this[i].clone();
    } else newObj[i] = this[i]
  } return newObj;
};

soundManager.setup({
    url: 'swf/soundmanager2_flash9.swf',
    flashVersion: 9,
    useFlashBlock: false
    // onready: function () {
    //     TAAPP.sound = soundManager.createSound({
    //         id: 'speech',
    //         url: TAAPP.state.speechAudio,
    //         autoPlay: false,
    //         autoLoad: true,
    //         volume: 100
    //     });
    // }
});

TAAPP.state = {
    // speechText: "scorerickard.json",
    // speechAudio: "scorerickard44.wav",
    // speechText: "sedaris.json",
    // speechAudio: "sedaris44mono.wav",
    // speechText: "bullw.json",
    // speechAudio: "bullw44.wav",
    speechReauthor: {},
    speechSampleRate: 44100
};

TAAPP.processPaste = function (a, b) {
    var parse_paste = /(?:\[(\d+)\]([^|]+)\|)/g,
        result,
        newOut = b,
        nRemoved = 0,
        nRemove,
        bRes = false,
        firstWord = true,
        sel = TAAPP.ta.getSelection(),
        pastedWords = [];
    // don't allow paste in the middle of a word
    if (a.length - b.length + sel.start !== 0 &&
        a.charAt(a.length - b.length + sel.start) !== ' ' &&
        a.charAt(a.length - b.length + sel.start - 1) !== ' ') {
            console.log("Can't insert here!");
            console.log(sel);
            return [a, a.length - b.length + sel.start];
    }
    
    while (result = parse_paste.exec(b)) {
        nRemove = 2 + result[1].length;

        // ugly!
        newOut = newOut.slice(0, result.index - nRemoved) +
            newOut.slice(result.index + nRemove - nRemoved,
                result.index + nRemove - nRemoved + result[2].length) +
            newOut.slice(result.index + nRemove - nRemoved + result[2].length + 1);
        nRemove++;
        
        // space before first word
        if (firstWord) {
            firstWord = false;
            if (a.length - b.length + sel.start !== 0 &&
                newOut.charAt(result.index - 1) !== ' ') {
                    newOut = newOut.slice(0, result.index) + ' ' +
                        newOut.slice(result.index);
                    nRemoved--;
            }
        }
        
        // insert space at end of each word
        var wordEndIdx = result.index + result[2].length - nRemoved;
        var wordEnd = newOut.charAt(wordEndIdx);

        if (wordEnd !== ' ') {
            newOut = newOut.slice(0, wordEndIdx) + ' ' +
                newOut.slice(wordEndIdx);
            nRemoved--;
        }
        
        nRemoved += nRemove;
        bRes = true;
        pastedWords.push(parseInt(result[1]));
    }
    if (bRes) {
        _.defer(function () {
           TAAPP.insertWords(pastedWords, a.length - b.length + sel.start);
        });
        return [newOut, wordEndIdx];
    }
    return [a, a.length - b.length + sel.start];
};

TAAPP.processCopy = function () {
    var selection = window.getSelection(),
        newdiv = document.createElement('div'),
        sel = TAAPP.ta.getSelection(),
        wrds = TAAPP.currentRange(sel.start, sel.end),
        mod;

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
    words = _.map(indices, function (idx) {
        return TAAPP.words[idx].clone() 
    });
    // insert them
    args = [i, 0].concat(words);
    Array.prototype.splice.apply(TAAPP.current, args);
    TAAPP.updatePos();
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
        autoPlay: true,
        onload: function () {
            _.each(data.timing, function (elt, idx, list) {
                var cwTime = elt[1] * 1000.0,
                    first = elt[0],
                    last = TAAPP.current.length;
                if (idx < list.length - 1) {
                    last = list[idx + 1][0];
                }
                TAAPP.timing = data.timing;
                this.onPosition(cwTime, function () {
                    TAAPP.highlightWords(first, last);
                });
            }, this);
        },
        onfinish: function () {
            TAAPP.highlightWords(-1);
        }
    });
};

TAAPP.highlightWords = function (start, end) {
    TAAPP.updateText();
    if (start === -1) {
        $(".highlights").html("");
        return;
    }
    
    var hlHTML = _.reduce(TAAPP.current, function (memo, word, idx) {
        if (idx === start && idx === end - 1) {
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
    var scrHeight = TAAPP.ta.prop("scrollHeight") + 'px';
    TAAPP.ta.height(scrHeight);
    $('.highlights').height(scrHeight);
    $('.hlContainer').height(scrHeight);
};

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

TAAPP.reset = function () {
    TAAPP.state.speechText = TAAPP.speech + ".json";
    TAAPP.state.speechAudio = TAAPP.speech + "44.wav";
    if (TAAPP.sound) {
        TAAPP.sound.destruct();
        TAAPP.sound = undefined;
    }
    TAAPP.current = undefined;
    TAAPP.timing = undefined;
    
    $.getJSON(TAAPP.state.speechText, function (data) {
        var words = data.words;
        TAAPP.words = words;
        TAAPP.current = TAAPP.words.clone();
        TAAPP.updatePos();

        TAAPP.ta.val(_.reduce(words, function (memo, word) {
            return memo + word.word + ' ';
        }, ""));
        
        TAAPP.adjustHeight();
    });
};  

TAAPP.loadSite = function () {
    $('select[name=speechSelect]').change(function() {
        console.log("Changing to " + $(this).val());
        TAAPP.speech = $(this).val();
        TAAPP.reset();
    });
    
    TAAPP.speech = $('select[name=speechSelect]').val();
    TAAPP.state.outfile = Math.random().toString(36).substring(12);
    TAAPP.reset();
    
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
            TAAPP.ta.val(res[0]);
            TAAPP.ta.setSelection(res[1], res[1]);
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
            // can fix this later to allow better shift-based text selection
            _.defer(TAAPP.snapSelectionToWord);
        } else if (e.which === 13) {
            if (TAAPP.sound) {
                TAAPP.sound.pause();
            }
            TAAPP.highlightWords(-1);
            TAAPP.generateAudio();
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
    
    $("body").keyup(function (e) {
        if (e.keyCode === 80) {
            TAAPP.sound.togglePause();
        }
    });
};

$(function () {
    TAAPP.loadSite();
});

