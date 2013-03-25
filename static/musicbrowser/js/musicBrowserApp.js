// $.ajaxSetup({ cache:false });

var MBAPP = {};

MBAPP.COLS = {
    "PIVOT": 10,
    "SORTER": 11,
    "CLIP": 0,
    "tPIVOT": 11,
    "tSORTER": 12,
};

var SOUND_ID = '';
    
$.extend( $.fn.dataTableExt.oStdClasses, {
    "sWrapper": "dataTables_wrapper form-inline"
} );
    
$.extend( $.fn.dataTableExt.oStdClasses, {
    "sSortAsc": "header headerSortDown",
    "sSortDesc": "header headerSortUp",
    "sSortable": "header"
} );
    
// sorting by "magic"
$.fn.dataTableExt.afnSortData['magic'] = function (oSettings, iColumn) {
    console.log("IN HERE, oSettings", oSettings, "iColumn", iColumn)
    var aData = [];
    // console.log(oSettings.oApi._fnGetTrNodes(oSettings));
    $('td:eq('+(iColumn - 1)+')', oSettings.oApi._fnGetTrNodes(oSettings))
        .each(function() {
            aData.push($(this).text());
        });
    // console.log(aData.length, aData);
    return aData;
}
    
// tempo range filtering
MBAPP.fnRangeFiltering = function(iColumn, sLo, sHi) {
    return function( oSettings, aData, iDataIndex ) {
        var iMin = $(sLo).html() * 1;
        var iMax = $(sHi).html() * 1;

        var iVersion = aData[iColumn] == "-" ? 0 : aData[iColumn]*1;
        if (iMin == "" && iMax == ""){ return true; }
        else if ( iMin == "" && iVersion < iMax )
        {
            return true;
        }
        else if ( iMin < iVersion && "" == iMax )
        {
            return true;
        }
        else if ( iMin < iVersion && iVersion < iMax )
        {
            return true;
        }
        return false;
    };
};
    
MBAPP.validIDs = 'all';
    
MBAPP.fnPivotValidIDs = function() {
    var constraints = [];
    $("#constraintButtons").find('button').each(function() {
        if ($(this).hasClass('active')) {
            constraints.push($(this).attr('data-constraint'))
        }
    })
        
    if (constraints.length === 0) {
        MBAPP.validIDs = 'all';
        return;
    }
        
    var pivot_id = $("#pivot").attr('data-pivot-song-id');
        
    if (pivot_id === '' || pivot_id === undefined) {
        MBAPP.validIDs = 'all';
        return;
    }
        
    q = '?c=' + JSON.stringify(constraints) + '&song_id=' + pivot_id;
    $.ajax({
        url: '/musicbrowser/constrained' + q,
        async: false,
        dataType: 'json',
        success: function(data) {
            MBAPP.validIDs = data.songs;
            console.log(data.query);
            var sorter = data.sorter;
            var idRE = /\d+/;
                
            // set the sorter column
            $('td:eq(' + MBAPP.COLS.SORTER + ')', MBAPP.oTable.$('tr')).each(function() {
                var match = idRE.exec(
                    $(this).parent()
                    .find('td:eq(' + MBAPP.COLS.PIVOT + ') button')
                    .attr('data-song-id'));
                var id = match[0];
                var idx = MBAPP.validIDs.indexOf(parseInt(id));
                if (idx !== -1) {
                    $(this).html(sorter[idx]);
                }
            })
        }
    });
        
};
    
MBAPP.fnPivotFiltering = function(oSettings, aData, iDataIndex) {
    if (MBAPP.validIDs === 'all') {
        return true;
    }
        
    var idRE = /\d+/;
    var match = idRE.exec(aData[MBAPP.COLS.tPIVOT]);
    var id = match[0];
    if (MBAPP.validIDs.indexOf(parseInt(id)) !== -1) {
        return true;
    }
    return false;
};
    
// MBAPP.gtfoGhostSong = function(oSettings, aData, iDataIndex) {
//     var idRE = new RegExp(/\d+/);
//     var match = idRE.exec(aData[12]);
//     var id = match[0];
//     return id !== '284';
// };
    
$.fn.dataTableExt.afnFiltering.push(
    MBAPP.fnRangeFiltering(6, "#tempoAmountLo", "#tempoAmountHi"),
    MBAPP.fnRangeFiltering(3, "#valenceAmountLo", "#valenceAmountHi"),
    MBAPP.fnRangeFiltering(4, "#arousalAmountLo", "#arousalAmountHi"),
    MBAPP.fnPivotFiltering);
    
MBAPP.oTable = undefined;

MBAPP.loadedSongs = {};

MBAPP.activateLinks = function () {
    $('.brPlayBtn').bind("click", function (e) {
        var songName = $(this).attr("data-file-name");
        
        // stop this song if it's playing
        if (songName in MBAPP.loadedSongs &&
            MBAPP.loadedSongs[songName].playState === 1) {
            MBAPP.loadedSongs[songName].stop();
            e.preventDefault();
            return;
        }
        
        // stop all playing clips
        for (var sn in MBAPP.loadedSongs) {
            if (MBAPP.loadedSongs.hasOwnProperty(sn)) {
                MBAPP.loadedSongs[sn].stop();
            }
        }
        var btn = $(this);

        if (songName in MBAPP.loadedSongs) {
            MBAPP.loadedSongs[songName].play();
        } else {
            MBAPP.loadedSongs[songName] = soundManager.createSound({
                id: songName,
                url: $(this).attr("href"),
                autoLoad: true,
                autoPlay: true,
                onstop: function () {
                    MBAPP.showPlayButton(btn);  
                },
                onplay: function () {
                    MBAPP.showStopButton(btn);
                },
                onfinish: function () {
                    MBAPP.showPlayButton(btn);
                }
            });
        }
        e.preventDefault();
        return false;
    });
};

MBAPP.showPlayButton = function (btn) {
    $(btn).html("<i class='icon-play'></i>");
};

MBAPP.showStopButton = function (btn) {
    $(btn).html("<i class='icon-stop'></i>");
}

MBAPP.loadTable = function () {
    MBAPP.oTable = $('#browser').dataTable( {
        "fnDrawCallback": function(oSettings) {
            if (soundManager !== undefined) {
                    soundManager.onready(function() { 
                        soundManager.stopAll(); 
                });
            }
        },
        "fnInitComplete": function(oSettings, json) {
            $("#filterPivot").click(function() {
                MBAPP.fnPivotValidIDs();
                MBAPP.oTable.fnDraw();    
                MBAPP.oTable.fnSort([[MBAPP.COLS.tSORTER, 'asc']]);
            });
            $("#removePivot").click(function() {
                $("#pivot").html('None')
                $("#pivot").attr('data-pivot-song-id', '')
                MBAPP.validIDs = 'all';
                MBAPP.oTable.fnDraw();
                $('td:eq(' + MBAPP.COLS.SORTER + ')', MBAPP.oTable.$('tr')).text('');
            })
            
            MBAPP.activateLinks();
        },
        "bProcessing": true,
        "bPaginate": false,
        "sPaginationType": "bootstrap",
        "sAjaxSource": 'static/musicbrowser/json/browser.json',
        "sDom": "<'row'<'span6'l><'span6'f>r>t<'row'<'span6'i><'span6'p>>",
        "aoColumns": [
            { "mDataProp": "filename",
              // "sWidth": "150px",
              "fnRender": function( o, val ) {
                  var addBtn = '<button class="btn brAddBtn" data-file-name="' + val + 
                        '"><i class="icon-plus"></i></button>';
                  var playBtn = '<a href="static/musicbrowser/mp3s/browser/context/' + val +
                        '.mp3" class="btn brPlayBtn" data-file-name="' + val +
                        '"><i class="icon-play"></i></a>';
                  return '<div class="btn-group">' + playBtn + addBtn +
                         '</div>';
                      
                return  '<div style="display:inline-block">' +
                        '<div class="sm2-inline-list"><div class="ui360">'+
                        '<a href="static/musicbrowser/mp3s/browser/context/' +
                        val + '.mp3" class="sm2_button">' +  
                        val + '</a></div>' + '</div>';
                /*'<div class="ui360"><a href="mp3s/browser/v1/Change Point1 - ' +
                        val + '.mp3" class="sm2_button">' + 
                        val + '</a></div></div>';*/
                },
            "fnCreatedCell": function(nTd, sData, oData, iRow, iCol) {
                $(nTd).find('.brAddBtn').click(function () {
                    var filename = $(this).attr("data-file-name") + ".mp3";
                    $.get('uploadSong?filename=' + filename, function (data) {
                        TAAPP.addSongToLibrary(data);
                    });
                });
            }},
            { "mDataProp": "title" },
            { "mDataProp": "artist" },
            { "mDataProp": "valence" },
            { "mDataProp": "arousal" },
            { "mDataProp": "mode" },
            { "mDataProp": "tempo" },
            // { "mDataProp": "rms_energy" },
            { "mDataProp": "danceability" },
            { "mDataProp": "categories",
              "fnRender": function(o, val) {
                return val.join(', ');
            } },
            { "mDataProp": "tags",
              "bVisible": false },
            { "mDataProp": "tags",
              "fnRender": function( o, val ) {
                    var tags = val.join(', ');
                    if (tags !== '') {
                        return '<div title="' + tags + '">(Hover)</div>';
                    }
                    return '<div></div>';
                },
              "fnCreatedCell": function(nTd, sData, oData, iRow, iCol) {
                    var p = $(nTd).children().first()
                        .tooltip({
                            position: {
                                my: "right top+15",
                                at: "right center"
                            }
                        });
            }},
            { "mDataProp": "song_id",
              "fnRender": function(o, val) {
                    var out =
                        '<button class="btn" data-song-id="'+ val +'">Pivot</button>';
                    return out;
            },
              "fnCreatedCell": function(nTd, sData, oData, iRow, iCol) {
                    var val = oData.song_id;
                    var song_id = $(nTd).find('button')
                        .attr('data-song-id');
                    $(nTd).find('button').click(function() {
                        $("#pivot").html('"' + oData.title + 
                                '" - ' + oData.artist); 
                        $("#pivot").attr('data-pivot-song-id', song_id);
                    })
            }
            },
            {   "mDataProp": "sorter",
                "sSortDataType": "magic",
                "sType": "numeric" }
        ]
    } );

}; 

$(document).ready(function() {
    MBAPP.loadTable();
    
    $("#constraintButtons button").click(function () {
        $(this).button("toggle");
    });
});
    
MBAPP.generalSlide = function(sliderLo, sliderHi) {
    return function(event, ui) {
        $(sliderLo).html(ui.values[0]);
        $(sliderHi).html(ui.values[1]);
        MBAPP.oTable.fnDraw();
    };
};
    
MBAPP.sliderTextInit = function(sliderID, sliderLo, sliderHi) {
    $(sliderLo).html($(sliderID).slider("values", 0));
    $(sliderHi).html($(sliderID).slider("values", 1));
};
    
$(function() {
    $("#tempoSlider").slider({
        range: true,
        max: 250,
        min: 0,
        values: [0, 250],
        slide: MBAPP.generalSlide("#tempoAmountLo", "#tempoAmountHi"),
        change: MBAPP.generalSlide("#tempoAmountLo", "#tempoAmountHi")
        });
    MBAPP.sliderTextInit("#tempoSlider", "#tempoAmountLo", "#tempoAmountHi");
        
    $("#valenceSlider").slider({
        range: true,
        max: 200,
        min: -200,
        values: [-200, 200],
        slide: MBAPP.generalSlide("#valenceAmountLo", "#valenceAmountHi"),
        change: MBAPP.generalSlide("#valenceAmountLo", "#valenceAmountHi")
    });
    MBAPP.sliderTextInit("#valenceSlider", "#valenceAmountLo", "#valenceAmountHi");
        
    $("#arousalSlider").slider({
        range: true,
        max: 200,
        min: -200,
        values: [-200, 200],
        slide: MBAPP.generalSlide("#arousalAmountLo", "#arousalAmountHi"),
        change: MBAPP.generalSlide("#arousalAmountLo", "#arousalAmountHi")
    });
    MBAPP.sliderTextInit("#arousalSlider", "#arousalAmountLo", "#arousalAmountHi");
        
    // dealing with coarse V/A filters
    $("#coarseVAFilter button").click(function(e) {
        if ($(this).attr("value") == 1) {
            $("#valenceSlider").slider("option", "values", [-5, 200]);
            $("#arousalSlider").slider("option", "values", [-5, 200]);
        } else if ($(this).attr("value") == 2) {
            $("#valenceSlider").slider("option", "values", [-200, 5]);
            $("#arousalSlider").slider("option", "values", [-5, 200]);
        } else if ($(this).attr("value") == 3) {
            $("#valenceSlider").slider("option", "values", [-200, 5]);
            $("#arousalSlider").slider("option", "values", [-200, 5]);
        } else if ($(this).attr("value") == 4) {
            $("#valenceSlider").slider("option", "values", [-5, 200]);
            $("#arousalSlider").slider("option", "values", [-200, 5]);
        }
    });
});


MBAPP.tree;
MBAPP.points;
MBAPP.songData;

$(function() {
    MBAPP.findNearest = function(point, pointNames) {
        var idx = pointNames.indexOf(point);
        var nn = MBAPP.tree.nearest(MBAPP.points[idx], 6);
        nn = nn.sort(function(a,b) { return a[1] - b[1]});
        var result = "<div>";
        var query = ''
        for (var i=0; i < nn.length; i++) {
            for (var s=0; s < MBAPP.songData.length; s++) {
                if (MBAPP.songData[s].title === nn[i][0].title &&
                    MBAPP.songData[s].artist === nn[i][0].artist) {
                    var filename = MBAPP.songData[s].filename;
                    result +='<div class="ui360"><a href="static/musicbrowser/mp3s/browser/context/' +
                        filename +'.mp3" class="sm2_button">'+ 
                        filename + ' (' +
                        nn[i][1].toPrecision(3) +
                        ')</a></div>';
                }
            }       
        }
        result += '</div>';
        $('.nearest').html(result);
        if (soundManager !== undefined) {
            soundManager.reboot();
            $.getScript('static/musicbrowser/js/360player.js', function() {});
        }
    };
        
    MBAPP.reloadFeatures = function(featuresJSON) {
        $.getJSON(featuresJSON, function(data) {
            MBAPP.points = data;
            var dimensions = ["c0", "c1", "c2", "c3", "c4", "c5", "c6",
                "c7", "c8", "c9", "c10", "c11", "c12"];
            var distance = function(a, b) {
                var dimensions = ["c0", "c1", "c2", "c3", 
                    "c4", "c5", "c6",
                    "c7", "c8", "c9", "c10", "c11", "c12"];
                var tot = 0;
                for (var i=0; i < dimensions.length; i++) {
                    tot += Math.pow(
                        a[dimensions[i]] - b[dimensions[i]], 2);
                }
                return Math.sqrt(tot);
            }

            MBAPP.tree = new kdTree(MBAPP.points, distance, dimensions);
            
            var pointNames = [];
            for (x in MBAPP.points) {
                pointNames.push(MBAPP.points[x].artist +
                        ' - ' + MBAPP.points[x].title);
            }
                
            // only comes into effect on feature change request
            var point = $('.typeahead').val();
            if (pointNames.indexOf(point) !== -1) {
                MBAPP.findNearest(point, pointNames);
            }
            
            $('.typeahead').typeahead({
                source: pointNames,
                onselect: function(point) {
                    MBAPP.findNearest(point, pointNames);
                }
            });
            
        })
    }
    
    var featureIndex = "mfccs";
    var features = {
        mfccs: "static/musicbrowser/json/changepoints_mfccs.json",
        wmfccs: "static/musicbrowser/json/changepoints_mfccs_whitened.json"
    };
        
    $('.featureType').find('button').bind('click', function(event) {
        if ($(this).prop('id') === "mfccs") {
            featureIndex = "mfccs";
        } else if ($(this).prop('id') === "wmfccs") {
            featureIndex = "wmfccs";
        }
        $('.nearest').html("");
        MBAPP.reloadFeatures(features[featureIndex]);
    });
        
    MBAPP.reloadFeatures(features[featureIndex]);
        
    $.getJSON("static/musicbrowser/json/browser.json", function(data) {
        MBAPP.songData = data.aaData;
    });
        
});
