(function() {
  var $, DEBUG, ScriptArea, TextAreaManager,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __slice = [].slice;

  $ = jQuery;

  DEBUG = false;

  ScriptArea = (function() {
    function ScriptArea(tam, name, speaker, settings) {
      var containers,
        _this = this;
      this.tam = tam;
      this.name = name;
      this.speaker = speaker;
      this.adjustSelection = __bind(this.adjustSelection, this);
      if (settings == null) {
        settings = {};
      }
      this.locked = "locked" in settings ? settings.locked : false;
      this.el = $("<div>\n<div class=\"emContainerTAM\">\n    <div class=\"emphasisTAM\"></div>\n</div>\n<div class=\"hlContainerTAM\">\n    <div class=\"highlightsTAM\"></div>\n</div>\n<div class=\"taContainerTAM\">\n    <textarea class=\"txtAreaTAM\" name=\"area" + name + "\"></textarea>\n</div>\n<div class=\"overlayContainerTAM\">\n    <div class=\"overlaysTAM\"></div>\n</div>\n</div>");
      this.hlContainer = this.el.find('.hlContainerTAM');
      this.highlights = this.el.find('.highlightsTAM');
      this.emContainer = this.el.find('.emContainerTAM');
      this.emphasis = this.el.find('.emphasisTAM');
      this.overlayContainer = this.el.find('.overlayContainerTAM');
      this.overlays = this.el.find('.overlaysTAM');
      this.taContainer = this.el.find('.taContainerTAM');
      this.area = this.el.find(".txtAreaTAM");
      containers = [this.area, this.hlContainer, this.highlights, this.emContainer, this.emphasis, this.overlayContainer, this.overlays, this.taContainer];
      this.$containers = $(_.map(containers, function(c) {
        return c[0];
      }));
      this.area.bind('copy', function(e) {
        return _this.tam.processCopy(_this);
      }).bind('cut', function(e) {
        console.log("Cut not supported at this time");
        e.preventDefault();
        return false;
        return _this.tam.processCut(_this);
      }).bind('paste', function(e) {
        if (_this.locked) {
          return e.preventDefault();
        } else {
          return _this.tam.processPaste(_this, _this.area.val());
        }
      }).keypress(function(e) {
        if (e.which >= 32) {
          e.preventDefault;
        }
        return false;
      }).keydown(function(e) {
        var tai;
        switch (e.which) {
          case 8:
            e.preventDefault();
            if (!_this.locked) {
              _this.tam.processDelete(_this, "backward");
            }
            return false;
          case 46:
            e.preventDefault();
            if (!_this.locked) {
              _this.tam.processDelete(_this, "forward");
            }
            return false;
          case 37:
          case 38:
          case 39:
          case 40:
            if (e.shiftKey) {
              return _.defer(_this.snapSelectionToWord);
            }
            break;
          case 13:
            "reauthor";
            return e.preventDefault();
          case 90:
            return false;
          case 190:
            e.preventDefault();
            if (!_this.locked) {
              return _this.addPeriod();
            }
            break;
          case 69:
            e.preventDefault();
            return _this.insertEmphasisPoint();
          case 87:
            tai = _this.tam.tas.indexOf(_this);
            if (tai > 0) {
              _this.tam.tas[tai - 1].area.setSelection(0);
              _this.tam.lastFocused = _this.tam.tas[tai - 1];
              _this.tam.container.stop().scrollTo($(_this.tam.tas[tai - 1].area), 200, {
                offset: -200
              });
            }
            return e.preventDefault();
          case 83:
            tai = _this.tam.tas.indexOf(_this);
            if (tai + 1 < _this.tam.tas.length) {
              _this.tam.tas[tai + 1].area.setSelection(0);
              _this.tam.lastFocused = _this.tam.tas[tai + 1];
              _this.tam.container.stop().scrollTo($(_this.tam.tas[tai + 1].area), 200, {
                offset: -200
              });
            }
            return e.preventDefault();
        }
      }).bind('mousemove', function() {}).bind('mouseup', this.adjustSelection);
      this.overlays.bind('mouseup', this.adjustSelection);
    }

    ScriptArea.prototype.adjustSelection = function() {
      var endInd, sel, startInd, _ref;
      this.tam.lastFocused = this;
      this.snapSelectionToWord();
      sel = this.area.getSelection();
      _ref = this.rangeIndices(sel.start, sel.end), startInd = _ref[0], endInd = _ref[1];
      return this.tam.highlightWordsInWaveform(startInd, endInd, this);
    };

    ScriptArea.prototype._renderWord = function(word, isTextArea, wrapLeft, wrapRight) {
      var ending, quoteEnd, _ref;
      if (wrapLeft == null) {
        wrapLeft = "";
      }
      if (wrapRight == null) {
        wrapRight = "";
      }
      ending = ['.', '?', '!'];
      quoteEnd = '."';
      if ((_ref = word.word[word.word.length - 1], __indexOf.call(ending, _ref) >= 0) || word.word.slice(-2) === quoteEnd) {
        if (isTextArea) {
          return "" + wrapLeft + word.word + wrapRight + "\n";
        }
        return "" + wrapLeft + word.word + wrapRight + "<br />";
      }
      return "" + wrapLeft + word.word + wrapRight + " ";
    };

    ScriptArea.prototype.updateWords = function(words) {
      var badWords, content, rw,
        _this = this;
      if (DEBUG) {
        console.log("UPDATE WORDS");
      }
      if (words) {
        this.words = words;
      }
      rw = this._renderWord;
      badWords = ["UH", "UM", "AH"];
      content = _.reduce(this.words, (function(memo, word) {
        var _ref;
        if (_ref = word.alignedWord, __indexOf.call(badWords, _ref) >= 0) {
          word.emph = true;
        }
        return "" + memo + (rw(word, true));
      }), "");
      this.val(content);
      this.tam.dirtyTas.push(this);
      this.refresh();
      return _.defer(function() {
        if (_this.words.length === 0 && _this.tam.tas.length !== 1) {
          return _this.tam.removeTA(_this);
        }
      });
    };

    ScriptArea.prototype.height = function() {
      return this.area.height();
    };

    ScriptArea.prototype.val = function(str) {
      return this.area.val(str);
    };

    ScriptArea.prototype.refresh = function() {
      if (DEBUG) {
        console.log("SA REFRESH");
      }
      this.updatePos();
      return this.adjustHeight();
    };

    ScriptArea.prototype.adjustHeight = function() {
      var scrHeight;
      if (DEBUG) {
        console.log("ADJUST HEIGHT OF", this);
      }
      this.area.height("20px");
      scrHeight = this.area.prop("scrollHeight") + 'px';
      this.$containers.height(scrHeight);
      return scrHeight;
    };

    ScriptArea.prototype.snapSelectionToWord = function() {
      var doneEnd, doneStart, oldLen, sel, spaces, text, _ref, _ref1, _ref2, _ref3;
      sel = this.area.getSelection();
      console.log(sel);
      doneEnd = false;
      doneStart = false;
      if (sel.length === 0) {
        return;
      }
      if (/^\s+$/.exec(sel.text)) {
        this.area.collapseSelection();
      }
      text = this.area.val();
      spaces = [" ", "\n"];
      if (sel.length > 0) {
        while (_ref = text.charAt(sel.start), __indexOf.call(spaces, _ref) >= 0) {
          doneStart = true;
          if (sel.start + 1 < sel.end) {
            this.area.setSelection(sel.start + 1, sel.end);
            sel = this.area.getSelection();
          } else {
            break;
          }
        }
        while ((_ref1 = text.charAt(sel.start - 1), __indexOf.call(spaces, _ref1) < 0) && text.charAt(sel.start - 1) !== "" && oldLen !== sel.length && !doneStart) {
          oldLen = sel.length;
          this.area.setSelection(sel.start - 1, sel.end);
          sel = this.area.getSelection();
        }
        while (_ref2 = text.charAt(sel.end - 1), __indexOf.call(spaces, _ref2) >= 0) {
          doneEnd = true;
          if (sel.start < sel.end - 1) {
            this.area.setSelection(sel.start, sel.end - 1);
            sel = this.area.getSelection();
          } else {
            break;
          }
        }
        while ((_ref3 = text.charAt(sel.end), __indexOf.call(spaces, _ref3) < 0) && text.charAt(sel.end) !== '' && oldLen !== sel.length && !doneEnd) {
          oldLen = sel.length;
          this.area.setSelection(sel.start, sel.end + 1);
          sel = this.area.getSelection();
        }
      }
      return console.log("end of snap", sel);
    };

    ScriptArea.prototype.insertEmphasisPoint = function() {
      var sel, word;
      TAAPP.use("addEmphasisPoint");
      this.selectWord("backward");
      sel = this.area.getSelection();
      this.area.setSelection(sel.end);
      word = this.range(sel.start, sel.end)[0];
      word.emphasisPoint = true;
      this.tam.dirtyTas.push(this);
      return this.tam.refresh();
    };

    ScriptArea.prototype.selectWord = function(direction) {
      var other, spaces, start, text, _ref, _ref1;
      if (direction == null) {
        direction = "backward";
      }
      start = this.area.getSelection().start;
      text = this.area.val();
      spaces = [" ", "\n"];
      if (direction === "backward") {
        other = start - 1;
        while ((_ref = text.charAt(other), __indexOf.call(spaces, _ref) >= 0) && text.charAt(other) !== '') {
          other -= 1;
        }
        this.area.setSelection(other, start);
      } else if (direction === "forward") {
        other = start + 2;
        while ((_ref1 = text.charAt(other), __indexOf.call(spaces, _ref1) >= 0) && text.charAt(other) !== '') {
          other += 1;
        }
        this.area.setSelection(start, other);
      }
      return this.snapSelectionToWord();
    };

    ScriptArea.prototype.updatePos = function() {
      var name;
      name = this.name;
      return _.each(this.words, (function(elt, i, words) {
        words[i].taPos = this.total;
        words[i].taIdx = name;
        return this.total += elt.word.length + 1;
      }), {
        "total": 0
      });
    };

    ScriptArea.prototype.rangeIndices = function(start, end) {
      var endInd, i, startInd, w, _i, _j, _len, _len1, _ref, _ref1;
      _ref = this.words;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        w = _ref[i];
        if (w.taPos >= start) {
          startInd = i;
          break;
        }
      }
      _ref1 = this.words;
      for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
        w = _ref1[i];
        if (w.taPos < end) {
          endInd = i;
        }
      }
      return [startInd, endInd];
    };

    ScriptArea.prototype.range = function(start, end) {
      var first, i, word, _i, _len, _ref;
      if (end == null) {
        _ref = this.words;
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          word = _ref[i];
          if (word.taPos >= start) {
            first = word.taPos;
            break;
          }
        }
        return [first, i];
      }
      return _.filter(this.words, function(word) {
        return word.taPos >= start && word.taPos < end;
      });
    };

    ScriptArea.prototype.addPeriod = function() {
      var addInds, breath, breathInds, gp1, gp2, i, range, sel, topBreaths,
        _this = this;
      TAAPP.use("addPeriod");
      console.log("Adding a period");
      sel = this.area.getSelection();
      range = this.range(sel.end);
      if (range[1] === 0) {
        return;
      }
      i = range[1] - 1;
      console.log("adding period to word", this.words[i]);
      if (__indexOf.call(this.words[i].word, '.') < 0) {
        this.words[i].word += '.';
      }
      breathInds = this.tam.breathInds[this.speaker];
      topBreaths = _.sortBy(breathInds, function(bi) {
        return -_this.tam.words[bi].likelihood;
      });
      breath = topBreaths[Math.floor(Math.random() * topBreaths.length)];
      addInds = [breath];
      if (TAAPP.roomTone != null) {
        gp1 = '{gp-0.02}';
        gp2 = '{gp-0.05}';
        addInds = [gp1, breath, gp2];
      }
      return this.tam.insertWords(addInds, range.end, this);
    };

    ScriptArea.prototype.highlightWords = function(start, end) {
      var hlHTML, rw;
      rw = this._renderWord;
      hlHTML = _.reduce(this.words, (function(memo, word, idx) {
        var wrapLeft, wrapRight;
        wrapLeft = "";
        wrapRight = "";
        if (idx === start && (idx === end - 1 || (end == null))) {
          wrapLeft = "<span class='hl'>";
          wrapRight = "</span>";
        } else if (idx === start) {
          wrapLeft = "<span class='hl'>";
        } else if (idx === end - 1) {
          wrapRight = "</span>";
        }
        return "" + memo + (rw(word, false, wrapLeft, wrapRight));
      }), "");
      return this.highlights.html(hlHTML);
    };

    ScriptArea.prototype.emphasizeWords = function() {
      var ctx, emphHTML, rw,
        _this = this;
      ctx = [-1];
      rw = this._renderWord;
      emphHTML = _.reduce(this.words, (function(memo, word, idx) {
        var wrapLeft, wrapRight, _ref, _ref1;
        wrapLeft = "";
        wrapRight = "";
        if ((word.origPos != null) && word.origPos - 1 !== _this[0]) {
          wrapLeft += "<span class='editLocation'>";
          wrapRight += "</span>";
        }
        if ((word.emph != null) && word.emph) {
          wrapLeft += "<span class='emph'>";
          wrapRight += "</span>";
        }
        if ((word.emphasisPoint != null) && word.emphasisPoint) {
          wrapLeft += "<span class='ePt'>";
          wrapRight += "</span>";
        }
        if (word.alignedWord === "sp" || word.alignedWord === "gp") {
          wrapLeft += "<span class='pause'>";
          wrapRight += "</span>";
        } else if (word.alignedWord === "{BR}") {
          wrapLeft += "<span class='breath'>";
          wrapRight += "</span>";
        } else if (word.alignedWord === ((_ref = _this.words[idx - 1]) != null ? _ref.alignedWord : void 0) || ((_ref1 = _this.words[idx + 1]) != null ? _ref1.alignedWord : void 0) === word.alignedWord) {
          wrapLeft += "<span class='repeatedWord'>";
          wrapRight += "</span>";
        }
        _this[0] = word.origPos;
        return "" + memo + (rw(word, false, wrapLeft, wrapRight));
      }), "", ctx);
      return this.emphasis.html(emphHTML);
    };

    ScriptArea.prototype.insertDupeOverlays = function(dupes, dupeInfo) {
      var box, boxHTML, context, dupeDropdownWrapLeft, dupeDropdownWrapRight, dupeOrder, dupeStarts, dupeStartsFirsts, locked, offset, rw, self, taWidth;
      if (DEBUG) {
        console.log("SA INSERT DUPE OVERLAYS", this);
      }
      box = this.overlays;
      context = {
        dupeOrder: [],
        bounds: []
      };
      dupeOrder = [];
      dupeStartsFirsts = dupeInfo.firsts;
      dupeStarts = dupeInfo.starts;
      offset = this.tam.taIndexSpan[this.tam.tas.indexOf(this)];
      dupeDropdownWrapLeft = "<span class=\"dropdown overlay\">\n    <span class=\"dropdown-toggle\">";
      dupeDropdownWrapRight = "    </span>\n    <ul class=\"dropdown-menu\" role=\"menu\" aria-labelledby=\"dLabel\">\n        <li class=\"disabled\"><a><%= header %></a></li>\n        <% _.each(dupes[dupeIdx], function (elt) { %>\n            <li><span \n                   class=\"dupeOpt\"\n                   tabindex=\"-1\">\n                   <i class=\"icon-play dupePlayButton\"></i>\n                   <div style=\"position:relative; display:inline-block\">\n                   <span class=\"copyButton\"><%= elt[1] %></span>\n                   </div>\n                </span>\n            </li>\n        <% }) %>\n    </ul>\n</span>";
      rw = this._renderWord;
      locked = this.locked;
      boxHTML = _.reduce(this.words, (function(memo, word, idx, words) {
        var allIdx, d, dupeIdx, header, sentenceEnd, wrapLeft, wrapRight;
        dupeIdx = dupeStartsFirsts.indexOf(word.origPos);
        wrapLeft = "";
        wrapRight = "";
        if (dupeIdx !== -1) {
          sentenceEnd = idx;
          d = dupeStarts[dupeIdx];
          allIdx = d.idxInDupes;
          while (sentenceEnd < words.length && words[sentenceEnd].origPos >= d.dElt[0][0] && words[sentenceEnd].origPos <= d.dElt[0][1]) {
            sentenceEnd += 1;
          }
          this.dupeOrder.push(allIdx);
          this.bounds.push([idx, sentenceEnd - 1]);
          wrapLeft = dupeDropdownWrapLeft;
          header = locked ? "Similar sentences (click to copy)" : "Similar sentences";
          wrapRight = _.template(dupeDropdownWrapRight, {
            header: header,
            dupeIdx: allIdx,
            dupes: dupes
          });
        }
        if (word.alignedWord === "sp" || word.alignedWord === "gp") {
          wrapLeft += "<span class='pauseOverlay'>";
          wrapRight += "</span>";
        }
        if (word.alignedWord === "{BR}") {
          wrapLeft += "<span class='breathOverlay'>";
          wrapRight += "</span>";
        }
        return "" + memo + (rw(word, false, wrapLeft, wrapRight));
      }), "", context);
      box.html(boxHTML);
      self = this;
      taWidth = this.area.width();
      this.area.unbind('.tam').bind('click.tam', function() {
        console.log("clicked on the box");
        return $('.dropdown.open').removeClass('open');
      });
      return box.find('.dropdown-toggle').dropdown().each(function(i) {
        var dupe, eltPos, end, pos, start;
        pos = $(this).offset();
        eltPos = self.area.offset();
        dupe = dupes[context.dupeOrder[i]];
        start = context.bounds[i][0];
        end = context.bounds[i][1];
        return $(this).click(function() {
          TAAPP.use("viewSimilarSentences");
          console.log("start", start, "end", end);
          return self.area.setSelection(self.words[start].taPos, self.words[end].taPos + self.words[end].word.length);
        }).next('.dropdown-menu').css({
          left: "" + (-pos.left + eltPos.left + 10) + "px",
          width: "" + (taWidth - 20) + "px"
        }).find('span.dupeOpt').each(function(j) {
          var indices, _i, _ref, _ref1, _results;
          if (locked) {
            $(this).closest('.dropdown').addClass('open');
            "zero clipboard is obnoxious for now";
            indices = (function() {
              _results = [];
              for (var _i = _ref = dupe[j][0][0], _ref1 = dupe[j][0][1]; _ref <= _ref1 ? _i <= _ref1 : _i >= _ref1; _ref <= _ref1 ? _i++ : _i--){ _results.push(_i); }
              return _results;
            }).apply(this);
            $(this).find('.copyButton').attr("data-clipboard-text", self.tam.generateCopyTextFromIndices(indices)).zclip({
              path: "static/swf/ZeroClipboard.swf",
              copy: self.tam.generateCopyTextFromIndices(indices),
              afterCopy: (function() {
                self.area.focus();
                console.log("COPPY", $(this).closest('.dropdown'));
                return $(this).closest('.dropdown').removeClass('open');
              })
            });
            $(this).find('.zclip').css({
              top: "-4px"
            });
            $(this).closest('.dropdown').removeClass('open');
          } else {
            $(this).click(function(event) {
              var newPos;
              TAAPP.use("replaceSentence");
              newPos = self.replaceWords(start, end, dupe[j][0][0], dupe[j][0][1]);
              self.area.setSelection(newPos[0], newPos[1]);
              return false;
            });
          }
          return $(this).find('.dupePlayButton').click(function(event) {
            var audioend, audiostart;
            TAAPP.use("playSimilarSentence");
            audiostart = self.tam.words[dupe[j][0][0]].start;
            audioend = self.tam.words[dupe[j][0][1]].end;
            TAAPP.origSound.play({
              from: audiostart * 1000.0,
              to: audioend * 1000.0,
              onstop: function() {
                if ($(this).closest('.dropdown').hasClass('open')) {
                  return self.area.focus();
                }
              }
            });
            return event.stopPropagation();
          });
        });
      });
    };

    ScriptArea.prototype.replaceWords = function(c1, c2, w1, w2) {
      return this.tam.replaceWords(c1, c2, w1, w2, this, this.words[c1].taPos);
    };

    return ScriptArea;

  })();

  TextAreaManager = (function() {
    function TextAreaManager(el, speakers, words, current, settings) {
      var speaker, tr, _i, _len, _ref,
        _this = this;
      this.el = el;
      this.speakers = speakers;
      this.words = words;
      this.current = current;
      if (settings == null) {
        settings = {};
      }
      this.locked = "locked" in settings ? settings.locked : false;
      this.textAlignedWfs = "wfs" in settings ? settings.wfs : null;
      this.headerTable = $(document.createElement('table')).attr("width", "100%").appendTo(this.el);
      this.container = $(document.createElement('div')).css({
        "overflow-x": "hidden",
        "overflow-y": "auto"
      }).appendTo(this.el);
      this.table = $(document.createElement('table')).attr("width", "100%").appendTo(this.container);
      tr = $(document.createElement('tr')).appendTo(this.headerTable);
      _.each(this.speakers, function(speaker) {
        var th;
        th = document.createElement('th');
        return $(th).html(speaker).width("" + (100 / _this.speakers.length) + "%").appendTo(tr);
      });
      this.tas = [];
      this.taIndexSpan = [];
      this.areas = [];
      this.dirtyTas = [];
      this.draw();
      this.breathInds = {};
      _ref = this.speakers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        speaker = _ref[_i];
        this.breathInds[speaker] = [];
      }
      _.each(this.words, function(word, i, cur) {
        var j;
        if (word.alignedWord === "{BR}") {
          j = i;
          while (j < _this.words.length) {
            if (!("speaker" in _this.words[j])) {
              j++;
            } else {
              break;
            }
          }
          if (j === _this.words.length) {
            return;
          }
          if ("speaker" in _this.words[j]) {
            return _this.breathInds[_this.words[j].speaker].push(i);
          }
        }
      });
      this.el.scrollTo(0);
    }

    TextAreaManager.prototype._tr = function(index) {
      var tr;
      tr = $(document.createElement('tr'));
      _.each(this.speakers, function(speaker) {
        var td;
        td = $(document.createElement('td'));
        return tr.append(td);
      });
      tr.find("td").width("" + (100 / this.speakers.length) + "%");
      if (index != null) {
        if (index === 0) {
          tr.prependTo(this.table);
        } else {
          tr.insertAfter(this.table.find('tr').eq(index - 1));
        }
      } else {
        tr.appendTo(this.table);
      }
      return tr;
    };

    TextAreaManager.prototype._newScriptArea = function(name, speaker, index) {
      var ta;
      ta = new ScriptArea(this, name, speaker, {
        locked: this.locked
      });
      if (index != null) {
        this.tas.splice(index, 0, ta);
        this.areas.splice(index, 0, ta.area);
      } else {
        this.tas.push(ta);
        this.areas.push(ta.area);
      }
      return ta.el;
    };

    TextAreaManager.prototype.refresh = function() {
      var i, ta, _i, _len, _ref;
      if (DEBUG) {
        console.log("TAM REFRESH");
      }
      this.dirtyTas = _.uniq(this.dirtyTas);
      _ref = this.tas;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        ta = _ref[i];
        ta.name = i;
      }
      this.updatePos();
      this.adjustHeight();
      this.emphasizeWords();
      this.insertDupeOverlays(this.dupes, this.dupeInfo);
      if (this.textAlignedWfs != null) {
        $(_.values(this.textAlignedWfs)).textAlignedWaveform({
          currentWords: this.current
        });
      }
      return this.dirtyTas = [];
    };

    TextAreaManager.prototype.adjustHeight = function(forceAll) {
      var height, ta, taSet, _i, _len;
      if (DEBUG) {
        console.log("ADJUST HEIGHT OF TAM");
      }
      if (forceAll == null) {
        forceAll = false;
      }
      taSet = forceAll ? this.tas : this.dirtyTas;
      for (_i = 0, _len = taSet.length; _i < _len; _i++) {
        ta = taSet[_i];
        height = ta.adjustHeight();
        ta.el.closest('tr').height(height);
      }
      console.log("container height", window.innerHeight - this.el.offset().top - 50);
      this.container.height(window.innerHeight - this.el.offset().top - 50);
      console.log("el height", window.innerHeight - this.el.offset().top - 50);
      return this.el.height(window.innerHeight - this.el.offset().top - 50);
    };

    TextAreaManager.prototype.draw = function() {
      var count, lastSpeaker,
        _this = this;
      this.table.find("tr").remove();
      lastSpeaker = this.speakers[0];
      count = 0;
      this.taIndexSpan = [0];
      _.each(this.current, function(word, i) {
        var col, tr;
        if (i === 0) {
          col = 0;
          tr = _this._tr();
          return tr.find("td").eq(col).append(_this._newScriptArea(count++, lastSpeaker));
        } else if ((word.speaker != null) && word.speaker !== lastSpeaker) {
          _this.taIndexSpan.push(i);
          col = _this.speakers.indexOf(word.speaker);
          tr = _this._tr();
          tr.find("td").eq(col).append(_this._newScriptArea(count++, word.speaker));
          return lastSpeaker = word.speaker;
        }
      });
      _.each(this.taIndexSpan, function(start, i) {
        var words;
        if (i === _this.taIndexSpan.length - 1) {
          words = _this.current.slice(start);
        } else {
          words = _this.current.slice(start, _this.taIndexSpan[i + 1]);
        }
        return _this.tas[i].updateWords(words);
      });
      this.dirtyTas = this.tas.slice(0);
      this.refresh();
      return this.lastFocused = this.tas[0];
    };

    TextAreaManager.prototype.pruneByTAPos = function(start, end, ta) {
      var match;
      if (DEBUG) {
        console.log("PRUNE BY TA POS");
      }
      match = [];
      _.each(ta.words, function(word, idx) {
        if (word.taPos >= start && word.taPos < end) {
          return match.push(idx);
        }
      });
      console.log("prune by TA", match[0], _.last(match));
      return this.pruneByTAIndex(match[0], _.last(match) + 1, ta);
    };

    TextAreaManager.prototype.pruneByTAIndex = function(start, end, ta, refresh) {
      var offset, taIndex;
      if (DEBUG) {
        console.log("PRUNE BY TA INDEX");
      }
      if (refresh == null) {
        refresh = true;
      }
      taIndex = this.tas.indexOf(ta);
      offset = this.taIndexSpan[taIndex];
      return this.pruneCurrent(start + offset, end + offset, refresh);
    };

    TextAreaManager.prototype.pruneCurrent = function(start, end, refresh) {
      var cutWords, i, ta, taIndex, txtarea, _i, _len, _ref;
      if (DEBUG) {
        console.log("PRUNE CURRENT");
      }
      if (refresh == null) {
        refresh = true;
      }
      cutWords = this.current.splice(start, end - start);
      console.log("start", start, "end", end, "cutwords", cutWords);
      taIndex = cutWords[0].taIdx;
      ta = this.tas[taIndex];
      console.log("taIndex", taIndex, "ta", ta);
      _ref = this.tas;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        txtarea = _ref[i];
        if (i > taIndex) {
          this.taIndexSpan[i] -= end - start;
        }
      }
      if (taIndex === this.tas.length - 1) {
        ta.updateWords(this.current.slice(this.taIndexSpan[taIndex]));
      } else {
        console.log("Prune current, updating ta with words", this.taIndexSpan[taIndex], this.taIndexSpan[taIndex + 1] - 1);
        ta.updateWords(this.current.slice(this.taIndexSpan[taIndex], this.taIndexSpan[taIndex + 1]));
      }
      if (refresh) {
        return this.refresh();
      }
    };

    TextAreaManager.prototype.pruneAll = function() {
      var ta, _i, _len, _ref;
      _ref = this.tas;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ta = _ref[_i];
        ta.updateWords([]);
      }
      this.current.splice(0, this.current.length);
      return this.refresh();
    };

    TextAreaManager.prototype.highlightWordsInWaveform = function(start, end, ta) {
      var offset, speaker, _i, _len, _ref, _ref1, _ref2, _results;
      if (this.textAlignedWfs != null) {
        offset = this.taIndexSpan[this.tas.indexOf(ta)];
        if (((_ref = this.highlightedWordsRange) != null ? _ref[0] : void 0) !== offset + start || ((_ref1 = this.highlightedWordsRange) != null ? _ref1[1] : void 0) !== offset + end) {
          this.highlightedWordsRange = [offset + start, offset + end];
          $(this.textAlignedWfs[ta.speaker]).textAlignedWaveform({
            highlightedWordsRange: this.highlightedWordsRange
          });
          _ref2 = this.speakers;
          _results = [];
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            speaker = _ref2[_i];
            if (speaker !== ta.speaker) {
              _results.push($(this.textAlignedWfs[speaker]).textAlignedWaveform({
                highlightedWordsRange: void 0
              }));
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        }
      }
    };

    TextAreaManager.prototype.highlightWords = function(start, end) {
      var i, newEnd, offset, t, ta, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4;
      if (start === -1) {
        this.currentHighlight = void 0;
        _ref = this.tas;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ta = _ref[_i];
          ta.highlights.html("");
        }
        return;
      }
      if (((_ref1 = this.currentHighlight) != null ? _ref1[0] : void 0) > start && ((_ref2 = this.currentHighlight) != null ? _ref2[0] : void 0) < start + 3) {
        return;
      }
      this.currentHighlight = [start, end];
      _ref3 = this.tas;
      for (i = _j = 0, _len1 = _ref3.length; _j < _len1; i = ++_j) {
        ta = _ref3[i];
        if (this.taIndexSpan[i] > start) {
          break;
        }
      }
      if (i !== 0) {
        ta = this.tas[i - 1];
        offset = this.taIndexSpan[i - 1];
      } else {
        ta = this.tas[0];
        offset = this.taIndexSpan[0];
      }
      _ref4 = this.tas;
      for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
        t = _ref4[_k];
        t.highlights.html("");
      }
      if (end != null) {
        newEnd = end - offset;
      }
      return ta.highlightWords(start - offset, newEnd);
    };

    TextAreaManager.prototype.emphasizeWords = function() {
      var ta, _i, _len, _ref, _results;
      _ref = this.dirtyTas;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ta = _ref[_i];
        _results.push(ta.emphasizeWords());
      }
      return _results;
    };

    TextAreaManager.prototype.updatePos = function() {
      var count, i, ta, _i, _j, _len, _len1, _ref, _ref1, _results;
      this.highlightWords(-1);
      count = 0;
      this.taIndexSpan = [];
      _ref = this.tas;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        ta = _ref[i];
        ta.name = i;
        this.taIndexSpan.push(count);
        count += ta.words.length;
      }
      _ref1 = this.dirtyTas;
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        ta = _ref1[_j];
        _results.push(ta.updatePos());
      }
      return _results;
    };

    TextAreaManager.prototype.clean = function(ta) {
      var col, i, lastSpeaker, nextTa, offset, pattern, prevTa, segments, speakers, tai, tr, word, words, _i, _len, _ref;
      tai = this.tas.indexOf(ta);
      offset = this.taIndexSpan[tai];
      segments = [];
      pattern = [];
      speakers = [];
      _ref = ta.words;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        word = _ref[i];
        if ((word.speaker != null) && word.speaker !== lastSpeaker) {
          segments.push(i);
          speakers.push(word.speaker);
          pattern.push(word.speaker === ta.speaker);
          lastSpeaker = word.speaker;
        }
      }
      if (pattern.length === 1 && pattern[0]) {
        this.refresh();
        return;
      }
      if (pattern.length === 1 && !pattern[0]) {
        words = ta.words.slice(0);
        col = this.speakers.indexOf(lastSpeaker);
        ta.speaker = lastSpeaker;
        ta.el.closest('tr').find('td').eq(col).append(ta.el);
        this.refresh();
        return;
      }
      if (pattern.length === 2 && pattern[0]) {
        words = ta.words.slice(segments[1]);
        if (tai === this.tas.length - 1) {
          console.log("New row");
          col = this.speakers.indexOf(speakers[1]);
          tr = this._tr(tai + 1);
          tr.find("td").eq(col).append(this._newScriptArea(this.tas.length, speakers[1], tai + 1));
          ta.updateWords(ta.words.slice(0, segments[1]));
          this.tas[this.tas.length - 1].updateWords(words);
          this.tas[this.tas.length - 1].area.setSelection(0, 0);
          this.refresh();
        } else if (this.tas[tai + 1].speaker === speakers[1]) {
          console.log("Inserting in next row");
          console.log(this.tas, tai);
          nextTa = this.tas[tai + 1];
          ta.updateWords(ta.words.slice(0, segments[1]));
          nextTa.updateWords(words.concat(nextTa.words));
          nextTa.area.setSelection(0, 0);
          this.refresh();
        } else {
          window.alert("should not get here (right wrong pattern)");
        }
        console.log("CLEAN: @tas", this.tas, "taIndexSpan", this.taIndexSpan);
        return;
      }
      if (pattern.length === 2 && pattern[1]) {
        words = ta.words.slice(0, segments[1]);
        if (tai === 0) {
          console.log("New row (wrong right)");
          col = this.speakers.indexOf(speakers[0]);
          tr = this._tr(0);
          tr.find("td").eq(col).append(this._newScriptArea(this.tas.length, speakers[0], 0));
          ta.updateWords(ta.words.slice(segments[1]));
          this.tas[0].updateWords(words);
        } else if (this.tas[tai - 1].speaker === speakers[0]) {
          prevTa = this.tas[tai - 1];
          ta.updateWords(ta.words.slice(segments[1]));
          prevTa.updateWords(prevTa.words.concat(words));
        } else {
          window.alert("should not get here (wrong right pattern)");
        }
        ta.area.setSelection(0, 0);
        this.refresh();
        return;
      }
      if (pattern.length === 3) {
        words = ta.words.slice(0);
        col = this.speakers.indexOf(speakers[1]);
        tr = this._tr(tai + 1);
        tr.find("td").eq(col).append(this._newScriptArea(this.tas.length, speakers[1], tai + 1));
        col = this.speakers.indexOf(speakers[2]);
        tr = this._tr(tai + 2);
        tr.find("td").eq(col).append(this._newScriptArea(this.tas.length, speakers[2], tai + 2));
        ta.updateWords(words.slice(0, segments[1]));
        this.tas[tai + 1].updateWords(words.slice(segments[1], segments[2]));
        this.tas[tai + 2].updateWords(words.slice(segments[2]));
        this.refresh();
        this.tas[tai + 1].area.setSelection(0, 0);
      }
    };

    TextAreaManager.prototype.processDelete = function(ta, direction) {
      var end, sel, spaces, text, _ref;
      TAAPP.use("delete");
      if (DEBUG) {
        console.log("PROCESSDELETE");
      }
      if (window.TAAPP.sound) {
        window.TAAPP.sound.stop();
      }
      ta.snapSelectionToWord();
      sel = ta.area.getSelection();
      if (sel.length === 0) {
        ta.selectWord(direction, true);
      }
      sel = ta.area.getSelection();
      end = sel.end;
      text = ta.area.val();
      spaces = [" ", "\n"];
      while (_ref = text.charAt(end), __indexOf.call(spaces, _ref) >= 0) {
        end += 1;
      }
      console.log("calling prune by ta pos with start", sel.start, "end", end);
      this.pruneByTAPos(sel.start, end, ta);
      return ta.area.setSelection(sel.start, sel.start);
    };

    TextAreaManager.prototype.insertEmphasisPoint = function(ta) {
      if (ta == null) {
        ta = this.lastFocused;
      }
      return ta.insertEmphasisPoint();
    };

    TextAreaManager.prototype.insertWords = function(indices, pos, ta) {
      var args, ctx, i, loc, newEnd, offset, taIndex, word, words, _i, _j, _len, _ref, _ref1;
      console.log("INSERT WORDS", indices, "POS", pos, "TA", ta);
      if (ta == null) {
        ta = this.lastFocused;
      }
      if (pos == null) {
        pos = ta.area.getSelection().start;
      }
      taIndex = this.tas.indexOf(ta);
      offset = this.taIndexSpan[taIndex];
      _ref = ta.words;
      for (loc = _i = 0, _len = _ref.length; _i < _len; loc = ++_i) {
        word = _ref[loc];
        if (word.taPos >= pos) {
          break;
        } else if (loc === ta.words.length - 1) {
          loc = ta.words.length;
        }
      }
      ctx = {
        first: void 0,
        last: void 0,
        words: this.words
      };
      if (!_.isArray(indices)) {
        indices = [indices];
      }
      words = _.map(indices, (function(idx) {
        var tmp;
        if (idx.toString().split('-')[0] === '{gp') {
          tmp = clone(TAAPP.roomTone);
          tmp.word = idx;
          tmp.pauseLength = parseFloat(idx.split('-')[1]);
          if (this.first == null) {
            this.first = tmp;
          }
          this.last = tmp;
          return tmp;
        }
        tmp = clone(this.words[idx]);
        if (this.first == null) {
          this.first = tmp;
        }
        this.last = tmp;
        return tmp;
      }), ctx);
      args = [loc + offset, 0].concat(words);
      Array.prototype.splice.apply(this.current, args);
      for (i = _j = 0, _ref1 = this.tas.length; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
        if (i > taIndex) {
          this.taIndexSpan[i] += words.length;
        }
      }
      this.dirtyTas.push(ta);
      if (taIndex === this.tas.length - 1) {
        ta.updateWords(this.current.slice(this.taIndexSpan[taIndex]));
      } else {
        ta.updateWords(this.current.slice(this.taIndexSpan[taIndex], this.taIndexSpan[taIndex + 1]));
      }
      this.clean(ta);
      this.refresh();
      newEnd = ctx.last.taPos + ctx.last.word.length;
      ta.area.setSelection(newEnd, newEnd);
      return this.current.indexOf(ctx.first);
    };

    TextAreaManager.prototype.processPaste = function(ta, a) {
      var _this = this;
      TAAPP.use("paste");
      return _.defer(function() {
        var b, bRes, count, ept, epts, firstIdx, parse_paste, pastedWords, result, sel, spaces, tai, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
        parse_paste = /(?:\[(\d+|gp),(e?)\]([^|]+)\|)/g;
        bRes = false;
        pastedWords = [];
        b = ta.area.val();
        sel = ta.area.getSelection();
        spaces = [" ", "\n"];
        if (a.length - b.length + sel.start !== 0 && (_ref = a.charAt(a.length - b.length + sel.start), __indexOf.call(spaces, _ref) < 0) && (_ref1 = a.charAt(a.length - b.length + sel.start - 1), __indexOf.call(spaces, _ref1) < 0)) {
          console.log("couldn't paste", a.length, b.length, sel.start);
          ta.area.val(a);
          _this.refresh();
          return;
        }
        count = 0;
        epts = [];
        while (result = parse_paste.exec(b)) {
          bRes = true;
          if (result[1] === 'gp') {
            pastedWords.push(result[3]);
          } else {
            pastedWords.push(parseInt(result[1], 10));
          }
          if (result[2] === 'e') {
            epts.push(count);
          }
          count += 1;
        }
        if (bRes) {
          firstIdx = _this.insertWords(pastedWords, a.length - b.length + sel.start, ta);
          for (_i = 0, _len = epts.length; _i < _len; _i++) {
            ept = epts[_i];
            _this.current[firstIdx + ept].emphasisPoint = true;
          }
          for (_j = 0, _len1 = epts.length; _j < _len1; _j++) {
            ept = epts[_j];
            _ref2 = _this.tas;
            for (tai = _k = 0, _len2 = _ref2.length; _k < _len2; tai = ++_k) {
              ta = _ref2[tai];
              if (_this.taIndexSpan[tai] <= ept && _this.taIndexSpan[tai] + ta.words.length > ept) {
                _this.dirtyTas.push(ta);
              }
            }
          }
          if (epts.length !== 0) {
            _this.refresh();
          }
          console.log("taindexspan after clean", _this.taIndexSpan);
          return;
        }
        ta.area.val(a);
        return _this.refresh();
      });
    };

    TextAreaManager.prototype.generateCopyTextFromIndices = function(indices) {
      var i, mod, wrds,
        _this = this;
      wrds = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = indices.length; _i < _len; _i++) {
          i = indices[_i];
          _results.push(this.current[i]);
        }
        return _results;
      }).call(this);
      mod = _.reduce(wrds, (function(memo, wrd) {
        var j, w, _i, _len, _ref;
        if (wrd.alignedWord === "gp") {
          return memo + '[gp]' + wrd.word + '|';
        }
        _ref = _this.words;
        for (j = _i = 0, _len = _ref.length; _i < _len; j = ++_i) {
          w = _ref[j];
          if (w.start === wrd.start && w.end === wrd.end) {
            break;
          }
        }
        return "" + memo + "[" + j + "]" + wrd.word + "|";
      }), "");
      return mod;
    };

    TextAreaManager.prototype.processCopy = function(ta) {
      var mod, newdiv, sel, selection, wrds,
        _this = this;
      TAAPP.use("copy");
      selection = window.getSelection();
      newdiv = document.createElement('div');
      sel = ta.area.getSelection();
      wrds = ta.range(sel.start, sel.end);
      mod = _.reduce(wrds, (function(memo, wrd) {
        var ept, j, w, _i, _len, _ref;
        ept = '';
        if ("emphasisPoint" in wrd && wrd.emphasisPoint) {
          ept = 'e';
        }
        if (wrd.alignedWord === "gp") {
          return "" + memo + "[gp," + ept + "]" + wrd.word + "|";
        }
        _ref = _this.words;
        for (j = _i = 0, _len = _ref.length; _i < _len; j = ++_i) {
          w = _ref[j];
          if (w.start === wrd.start && w.end === wrd.end) {
            break;
          }
        }
        return "" + memo + "[" + j + "," + ept + "]" + wrd.word + "|";
      }), "");
      $(newdiv).css({
        position: "absolute",
        left: "-99999px"
      }).html(mod).appendTo("body");
      selection.selectAllChildren(newdiv);
      return _.defer(function() {
        return $(newdiv).remove();
      });
    };

    TextAreaManager.prototype.processCut = function(ta) {
      var mod, newOut, sel, wrds,
        _this = this;
      sel = ta.area.getSelection();
      wrds = ta.range(sel.start, sel.end);
      newOut = ta.area.val();
      mod = _.reduce(wrds, (function(memo, wrd) {
        var j, w, _i, _len, _ref;
        if (wrd.alignedWord === "gp") {
          return memo + '[gp]' + wrd.word + '|';
        }
        _ref = _this.words;
        for (j = _i = 0, _len = _ref.length; _i < _len; j = ++_i) {
          w = _ref[j];
          if (w.start === wrd.start && w.end === wrd.end) {
            break;
          }
        }
        return "" + memo + "[" + j + "]" + wrd.word + "|";
      }), "");
      newOut = newOut.slice(0, sel.start) + mod + newOut.slice(sel.end + 1);
      return ta.area.val(newOut).setSelection(sel.start, sel.start + mod.length);
    };

    TextAreaManager.prototype.insertDupeOverlays = function(dupes, dupeInfo, forceAll) {
      var ta, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _results, _results1;
      this.dupes = dupes;
      this.dupeInfo = dupeInfo;
      if (DEBUG) {
        console.log("INSERT DUPE OVERLAYS");
      }
      if (forceAll == null) {
        forceAll = false;
      }
      if (DEBUG) {
        console.log("DIRTY:", this.dirtyTas);
      }
      if (this.dupes == null) {
        return;
      }
      if (forceAll) {
        _ref = this.tas;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ta = _ref[_i];
          ta.insertDupeOverlays(this.dupes, this.dupeInfo);
        }
        _ref1 = this.tas;
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          ta = _ref1[_j];
          _results.push(ta.adjustHeight());
        }
        return _results;
      } else {
        _ref2 = this.dirtyTas;
        _results1 = [];
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          ta = _ref2[_k];
          _results1.push(ta.insertDupeOverlays(this.dupes, this.dupeInfo));
        }
        return _results1;
      }
    };

    TextAreaManager.prototype.replaceWords = function(c1, c2, w1, w2, ta, pos) {
      this.pruneByTAIndex(c1, c2 + 1, ta);
      return this.insertWords(_.range(w1, w2 + 1), pos, ta);
    };

    TextAreaManager.prototype.removeTA = function(ta) {
      var taIndex;
      console.log("INDEX", this.tas.indexOf(ta, "REMOVING TA", ta));
      taIndex = this.tas.indexOf(ta);
      this.tas.splice(taIndex, 1);
      this.taIndexSpan.splice(taIndex, 1);
      this.table.find("tr").eq(taIndex).remove();
      console.log("TA", ta, "taIndex", taIndex, "@TAS", this.tas);
      if (taIndex !== 0 && taIndex < this.tas.length && this.tas[taIndex - 1].speaker === this.tas[taIndex].speaker) {
        console.log("### combining 2 text areas");
        this.tas[taIndex - 1].updateWords(this.tas[taIndex - 1].words.concat(this.tas[taIndex].words));
        this.removeTA(this.tas[taIndex]);
      }
      Array.prototype.push.apply(this.dirtyTas, this.tas.slice(taIndex));
      return this.refresh();
    };

    TextAreaManager.prototype.log = function() {
      var args, statements;
      statements = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      args = ["[TAM]"].concat(statements);
      return console.log.apply(console, args);
    };

    return TextAreaManager;

  })();

  window.TextAreaManager = TextAreaManager;

}).call(this);
