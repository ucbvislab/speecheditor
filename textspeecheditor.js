// text/speech alignment-based editor for audio

var text_speech_editor = function () {
    // private
    var speechFile = 'speech/scorerickard_first.wav';
    var alignmentFile = 'speech/scorerickard_first.json';
    var speech;
    var timing;
    var story = $('.story');
    var currentWord;
    var ignoredWords = [];
    
    var loadSpeech = function() {
        speech = soundManager.createSound({
            id: 'speech',
            url: speechFile,
            autoLoad: true,
            autoPlay: false,
            onload: function() {
                synchronizedPlay();
            },
            volume: 50
        });
    };
    
    var synchronizedPlay = function() {
        speech.play({
            whileplaying: sync
        })
    };
    
    var normalize = function normalize(s) {
        return s.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()\"\?]/g,"").toLowerCase();
    }
    
    var prepareText = function() {
        // wrap all words in a span element
        story.find('p').each(function() {
           var text = $(this).text();
           text = text.replace(/\s+/g, '</span> <span class="word">');
           text = '<span class="word">' + text + '</span>';
           $(this).html(text);
        });
        
        // label the words that we have found in our alignment
        
        var timingIndex = 0;
        story.find('.word').each(function() {
            if ((timingIndex < timing.length) &&
                (normalize(timing[timingIndex].word) ===
                 normalize($(this).text()))) {
                currentWord = currentWord || $(this);
                $(this).data("tseditor-start", timing[timingIndex].start)
                       .data("tseditor-end", timing[timingIndex].end)
                       .click(scrub);

                timingIndex++;
            }
        });
    };
    
    var setCurrentWord = function(elt) {
        currentWord.attr("style", "background-color:none");
        var skipped = false;
        while(ignoredWords.indexOf(elt[0]) != -1) {
            elt = nextWord(elt);
            skipped = true;
        }
        // if (skipped) {
        //     soundManager.setPosition('speech',
        //         elt.data('tseditor-start') * 1000);
        //     synchronizedPlay();
        // }
        currentWord = elt;
        currentWord.attr("style", "background-color:yellow");
    };
    
    var nextWord = function(word) {
        var next = word.next();
        if (next.length === 0) {
            next = word.parent().next().find('.word').first();
            if (next.length === 0) {
                return undefined;
            }
        }
        return next;
    };
    
    var prevWord = function(word) {
        var prev = word.prev();
        if (prev.length === 0) {
            prev = word.parent().prev().find('.word').last();
            if (prev.length === 0) {
                return undefined;
            }
        }
        return prev;
    };
    
    var extendIgnoredWords = function(eltlist) {
        $(eltlist).attr("style", "background-color:red");
        var first = eltlist[0];
        var last = eltlist[eltlist.length - 1];
        
        speech.onPosition(prevWord($(first)).data('tseditor-end') * 1000 - 250,
            function () {
               speech.setPosition(nextWord($(last))
                   .data('tseditor-start') * 1000);
            });
        
        ignoredWords.push.apply(ignoredWords, eltlist);
    };
    
    var scrub = function(e) {
        setCurrentWord($(e.target));
        soundManager.setPosition('speech',
            currentWord.data('tseditor-start') * 1000);
        synchronizedPlay();
    };
    
    var sync = function() {
        var position = this.position / 1000;
        if (currentWord.data('tseditor-end') < position) {
            // find the word that should be highlighted
            do {
                var nextParaWord =
                    currentWord.parent().next().find('.word').first();
                setCurrentWord(currentWord.next());
                if (currentWord.length === 0) {
                    setCurrentWord(nextParaWord);
                }

                if (currentWord.length === 0) {
                    break;
                }
                    
            } while (
                currentWord.data('tseditor-end') === undefined ||
                currentWord.data('tseditor-end') < position
            );
        }
    };
    
    // get all of the elements in the current selection
    // from
    // http://stackoverflow.com/questions/1482832/how-to-get-all-elements-that-are-highlighted
    function rangeIntersectsNode(range, node) {
        var nodeRange;
        if (range.intersectsNode) {
            return range.intersectsNode(node);
        } else {
            nodeRange = node.ownerDocument.createRange();
            try {
                nodeRange.selectNode(node);
            } catch (e) {
                nodeRange.selectNodeContents(node);
            }

            return range.compareBoundaryPoints(Range.END_TO_START,
                nodeRange) == -1 &&
                range.compareBoundaryPoints(Range.START_TO_END, nodeRange) == 1;
        }
    };

    function getSelectedElementTags(win) {
        var range, sel, elmlist, treeWalker, containerElement;
        sel = win.getSelection();
        if (sel.rangeCount > 0) {
            range = sel.getRangeAt(0);
        }

        if (range) {
            containerElement = range.commonAncestorContainer;
            if (containerElement.nodeType != 1) {
                containerElement = containerElement.parentNode;
            }

            treeWalker = win.document.createTreeWalker(
                containerElement,
                NodeFilter.SHOW_ELEMENT,
                function(node) { 
                    return rangeIntersectsNode(range, node) ?
                        NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }, 
                false
            );
            elmlist = [];
            if ($(treeWalker.currentNode).is('span.word')) {
                elmlist.push(treeWalker.currentNode);
            }
            while (treeWalker.nextNode()) {
                if ($(treeWalker.currentNode).is('span.word')) {
                    elmlist.push(treeWalker.currentNode);                    
                }
            }
            extendIgnoredWords(elmlist);
        }
    };
    
    document.onmouseup = function() { getSelectedElementTags(window) };
    
    // public
    return {
        setup: function() {
            soundManager.setup({
                url: 'swf/',
                flashVersion: 9,
                onready: function() {
                    $.getJSON(alignmentFile, function(data) {
                        timing = data.words;
                        prepareText();
                        loadSpeech();
                    }); 
                    
                },
                ontimeout: function() {
                    // console.log('SM2 init failed!');
                },
                defaultOptions: {
                }
            }); 
        },
    }
};

$(function() {
    var TSEDITOR = text_speech_editor();
    TSEDITOR.setup();
})