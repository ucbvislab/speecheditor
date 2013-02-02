/*jslint browser:true devel:true sloppy:true plusplus:true */
/*global soundManager */
/*global $ */

var REAUTHOR = {};

REAUTHOR.state = {
    speechText: "/static/scorerickard_first.json",
    speechAudio: "/static/scorerickard_first.wav",
    // speechText: "/static/sedaris.json",
    // speechAudio: "/static/sedaris.wav",
    speechReauthor: {},
    speechSampleRate: 16000
};

REAUTHOR.vis = {
    currentWords: undefined,
    currentWordsTime: undefined,
    updateCurrentWords: function (cw, cwTime) {
        if (REAUTHOR.vis.currentWordsTime &&
                cwTime < REAUTHOR.vis.currentWordsTime) {
            return;
        }
        REAUTHOR.vis.currentWordsTime = cwTime;
        if (REAUTHOR.vis.currentWords !== undefined) {
            $(REAUTHOR.vis.currentWords)
                .removeClass("ui-state-focus");
        }
        REAUTHOR.vis.currentWords = cw;
        if (cw !== undefined) {
            $(cw).addClass("ui-state-focus");
        }
    }
};

soundManager.setup({
    url: '/static/swf/soundmanager2_flash9.swf',
    flashVersion: 9,
    useFlashBlock: false,
    onready: function () {
        REAUTHOR.sound = soundManager.createSound({
            id: 'speech',
            url: REAUTHOR.state.speechAudio,
            autoPlay: false,
            autoLoad: true,
            volume: 100
        });
    }
});

REAUTHOR.registerListItem = function (li) {
    $(li).click(function (e) {
        var item, newElt;
        if (e.shiftKey) {
            item = this;
            $(item).hide(100, function () {
                item.remove();
            });
        } else if (e.altKey) {
            newElt = $(this).clone(true);
            $(newElt).insertAfter($(this));
        }
    });

    if ($(li).data("info").alignedWord === "sp") {
        $(li).data("info").pauseLength =
            parseFloat(
                ($(li).data("info").end - $(li).data("info").start)
                    .toFixed(2)
            );
        var lengthNode = $(document.createElement('span'))
            .addClass("pauseLength")
            .text($(li).data("info").pauseLength);
        $(li).addClass('pause').resizable({
            handles: "e, w",
            resize: function (event, ui) {
                var width = ui.size.width,
                    info = $(this).data("info"),
                    initTime = info.end - info.start,
                    initWidth = $(this).data("initWidth");

                info.pauseLength =
                    parseFloat((initTime * width / initWidth).toFixed(2));

                $(this).children(".pauseLength").text(info.pauseLength);
            },
            stop: function (event, ui) {
                $(this).data("info").modifiedPause = true;
            }
        }).append(lengthNode);
        $(li).data("initWidth", $(li).width());
    }
};

REAUTHOR.loadSite = function () {
    $("#sortable").sortable({ "cursor": "move" });
    $("#sortable").disableSelection();

    $.getJSON(REAUTHOR.state.speechText, function (data) {
        var words = data.words,
            i,
            li;
        for (i = 0; i < words.length; i++) {
            if (words[i].hasOwnProperty("word")) {
                li = $('<li class="ui-state-default">' +
                    words[i].word + '</li>');
                li.data("info", words[i]);
                $("#sortable").append(li);
            }
        }
        $("#sortable li").each(function () {
            REAUTHOR.registerListItem(this);
        });
    });

    $("body").keyup(function (e) {
        if (e.keyCode === 80) {
            REAUTHOR.sound.togglePause();
        } else if (e.keyCode === 13) {
            // user pushed enter/return
            var out = [];
            $("#sortable li").each(function () {
                out.push($(this).data("info"));
            });

            REAUTHOR.state.speechReauthor = { "words": out };

            $.ajax({
                url: '/reauthor',
                type: 'POST',
                dataType: 'json',
                contentType: 'json',
                data: JSON.stringify(REAUTHOR.state),
                success: function (data) {
                    if (REAUTHOR.sound !== undefined) {
                        REAUTHOR.sound.destruct();
                    }
                    REAUTHOR.sound = REAUTHOR.createSound(data);
                },
                error: undefined
            });
        }
    });
};

REAUTHOR.createSound = function (data) {
    return soundManager.createSound({
        id: 'speech',
        url: data.url,
        autoPlay: true,
        onload: function () {
            REAUTHOR.vis.currentWordsTime = undefined;
            var wrdsDom = $("#sortable li").toArray(),
                i,
                first,
                last,
                curWrds,
                cwTime,
                onPosFun,
                onPos;
            console.log("reauthor data", data);
            onPosFun = function (wDom, wTime) {
                return function () {
                    REAUTHOR.vis.updateCurrentWords(wDom, wTime);
                };
            };

            for (i = 0; i < data.timing.length; i++) {
                first = data.timing[i][0];

                if (i === data.timing.length - 1) {
                    last = wrdsDom.length;
                } else {
                    last = data.timing[i + 1][0];
                }
                curWrds = wrdsDom.slice(first, last);
                cwTime = data.timing[i][1] * 1000.0;
                onPos = onPosFun(curWrds, cwTime);
                this.onPosition(cwTime, onPos);
            }
        },
        onfinish: function () {
            REAUTHOR.vis.updateCurrentWords();
        },
        autoLoad: true,
        volume: 100
    });
};

REAUTHOR.findBreaths = function () {
    $.getJSON('/breaths',
        {
            speechText: REAUTHOR.state.speechText,
            speechAudio: REAUTHOR.state.speechAudio
        },
        function (data) {
            console.log(data);
        }
        );
};

$(function () {
    REAUTHOR.loadSite();
    REAUTHOR.findBreaths();
});