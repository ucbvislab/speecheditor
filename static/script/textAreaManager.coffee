# manage all of the text areas in two-person interview editing

$ = jQuery

class ScriptArea
    constructor: (@tam, @name, @speaker) ->
        @el= $("""
        <div>
        <div class="emContainerTAM">
            <div class="emphasisTAM"></div>
        </div>
        <div class="hlContainerTAM">
            <div class="highlightsTAM"></div>
        </div>
        <div class="taContainerTAM">
            <textarea class="txtAreaTAM" name="area#{name}"></textarea>
        </div>
        <div class="overlayContainerTAM">
            <div class="overlaysTAM"></div>
        </div>
        </div>
        """)
        
        @hlContainer = @el.find('.hlContainerTAM')
        @highlights = @el.find('.highlightsTAM')
        @emContainer = @el.find('.emContainerTAM')
        @emphasis = @el.find('.emphasisTAM')
        @overlayContainer = @el.find('.overlayContainerTAM')
        @overlays = @el.find('.overlaysTAM')
        @taContainer = @el.find('.taContainerTAM')
        @area = @el.find(".txtAreaTAM")
        
        containers = [@area, @hlContainer, @highlights,
                      @emContainer, @emphasis, @overlayContainer,
                      @overlays, @taContainer]
        @$containers = $(_.map containers, (c) -> c[0])
        
        @area.bind('copy', (e) => @tam.processCopy(@))
            .bind('cut', (e) => 
                console.log "Cut not supported at this time"
                e.preventDefault()
                return false
                @tam.processCut(@)
            )
            .bind('paste', (e) =>
                @tam.processPaste(@, @area.val())
            )
            .keypress((e) -> e.preventDefault if e.which => 0x20)
            .keydown((e) =>
                switch e.which
                    when 8
                        e.preventDefault()
                        @tam.processDelete(@, "backward")
                        return false
                    when 46
                        e.preventDefault()
                        @tam.processDelete(@, "forward")
                        return false
                    when 37, 38, 39, 40
                        if e.shiftKey
                            _.defer @snapSelectionToWord
                    when 13 then "reauthor"
                    when 90
                        # prevent undo for now...
                        return false                    
                )
            .bind('mouseup', => 
                @tam.lastFocused = @
                @snapSelectionToWord()
            )

    updateWords: (words) ->
        @words = words
        content = _.reduce words, ((memo, word) ->
            if word.alignedWord is "UH"\
            or word.alignedWord is "UM"
                word.emph = true
            return memo + word.word + ' '), ""
        @val(content)
        @refresh()
    
    height: ->
        @area.height()
    
    val: (str) ->
        @area.val(str)
        
    refresh: ->
        @updatePos()
        @adjustHeight()
    
    adjustHeight: ->
        @area.height "20px"
        scrHeight = @area.prop("scrollHeight") + 'px'
        @$containers.height(scrHeight)
    
    snapSelectionToWord: ->
        sel = @area.getSelection()
        doneEnd = false
        doneStart = false
        return if sel.length is 0

        # all spaces?
        if /^\s+$/.exec sel.text
            @area.collapseSelection()

        text = @area.val()

        if sel.length > 0
            # move start right
            while text.charAt(sel.start) is " "
                doneStart = true
                if sel.start + 1 < sel.end
                    @area.setSelection(sel.start + 1, sel.end)
                    sel = @area.getSelection()
                else
                    break

            # move start left
            while text.charAt(sel.start - 1) isnt " "\
            and text.charAt(sel.start - 1) isnt ""\
            and oldLen isnt sel.length\
            and not doneStart
                oldLen = sel.length
                @area.setSelection sel.start - 1, sel.end
                sel = @area.getSelection()

            # move end left
            while text.charAt(sel.end - 1) is ' '
                doneEnd = true
                if sel.start < sel.end - 1
                    @area.setSelection sel.start, sel.end - 1
                    sel = @area.getSelection()
                else
                    break

            # move end right
            while text.charAt(sel.end) isnt ' '\
            and text.charAt(sel.end) isnt ''\
            and oldLen isnt sel.length\
            and not doneEnd
                oldLen = sel.length
                @area.setSelection sel.start, sel.end + 1
                sel = @area.getSelection()
                
    selectWord: (direction) ->
        start = @area.getSelection().start
        text = @area.val()
        if direction is "backward"
            other = start - 1
            while text.charAt(other) is ' '\
            and text.charAt(other) isnt ''
                other -= 1
            @area.setSelection other, start

        else if direction is "forward"
            other = start + 2
            while text.charAt(other) is ' '\
            and text.charAt(other) isnt ''
                other += 1
            @area.setSelection start, other
        
        @snapSelectionToWord()
        
    updatePos: ->
        name = @name
        _.each @words, ((elt, i, words) ->
            words[i].taPos = this.total
            words[i].taIdx = name
            this.total += elt.word.length + 1
        ), "total": 0
    
    range: (start, end) ->
        if not end?
            for word, i in @words
                if word.taPos >= start
                    first = word.taPos
                    break

            return [first, i]
        
        return _.filter @words, (word) ->
            word.taPos >= start and word.taPos < end
    
    highlightWords: (start, end) ->    
        hlHTML = _.reduce @words, ((memo, word, idx) ->
            if idx is start and (idx is end - 1 or not end?)
                return "#{memo}<span class='hl'>#{word.word}</span> "
            if idx is start
                return "#{memo}<span class='hl'>#{word.word} "
            if idx is end - 1
                return "#{memo}#{word.word}</span> "
            return "#{memo}#{word.word} "
            ), ""
        
        @highlights.html(hlHTML)
    
    emphasizeWords: ->
        ctx = [-1]
        emphHTML = _.reduce @words, ((memo, word, idx) ->
            out = word.word
            if word.origPos? and word.origPos - 1 isnt this[0]
                out = "<span class='editLocation'>#{out}</span>"
            if word.emph? and word.emph
                out = "<span class='emph'>#{out}</span> "
            this[0] = word.origPos
            return "#{memo}#{out} "
            ), "", ctx
        @emphasis.html(emphHTML)
    
    insertDupeOverlays: (dupes, dupeInfo) ->
        box = @overlays
        context =
            dupeOrder: []
            bounds: []
        
        dupeOrder = []
        dupeStartsFirsts = dupeInfo.firsts
        dupeStarts = dupeInfo.starts
        
        offset = @tam.taIndexSpan[@tam.tas.indexOf @]
        
        dupeDropdownTemplate = """
            <span class="dropdown overlay">
                <span class="dropdown-toggle">
                    <%= word %>
                </span>
                <ul class="dropdown-menu" role="menu" aria-labelledby="dLabel">
                    <li class="disabled"><a>Similar sentences</a></li>
                    <% _.each(dupes[dupeIdx], function (elt) { %>
                        <li><a href="javascript:void(0)" 
                               class="dupeOpt"
                               tabindex="-1">
                               <i class="icon-play dupePlayButton"></i><%= elt[1] %>
                            </a>
                        </li>
                    <% }) %>
                </ul>
            </span>
        """
        
        boxHTML = _.reduce @words, ((memo, word, idx, words) ->
            dupeIdx = dupeStartsFirsts.indexOf word.origPos
            if dupeIdx isnt -1
                sentenceEnd = idx
                d = dupeStarts[dupeIdx]
                allIdx = d.idxInDupes
                while sentenceEnd < words.length\
                and words[sentenceEnd].origPos >= d.dElt[0][0]\
                and words[sentenceEnd].origPos <= d.dElt[0][1]
                    sentenceEnd += 1
                
                this.dupeOrder.push allIdx
                this.bounds.push [idx, sentenceEnd - 1]
                
                return memo + _.template(dupeDropdownTemplate,
                    word: word.word
                    dupeIdx: allIdx,
                    dupes: dupes) + ' '
            return "#{memo}#{word.word} "
            ), "", context
        
        box.html(boxHTML)
        
        # add bootstrap dropdown hook
        # and add event handlers because we were copying the raw html above
        self = @
        taWidth = @area.width()
        box.find('.dropdown-toggle').each((i) ->
            pos = $(@).offset()
            dupe = dupes[context.dupeOrder[i]]
            start = context.bounds[i][0]
            end = context.bounds[i][1]
            $(@).click( ->
                self.area.setSelection self.words[start].taPos,
                    self.words[end].taPos + self.words[end].word.length
            )
            .next('.dropdown-menu').css(
                left: "#{-pos.left + 30}px"
                width: "#{taWidth - 20}px"
            )
            .find('a.dupeOpt')
            .each((j) ->
                $(@).click((event) ->
                    newPos = self.replaceWords start, end,
                        dupe[j][0][0], dupe[j][0][1]
                    self.area.setSelection newPos[0], newPos[1]
                    return false
                )
                .find('.dupePlayButton')
                .click((event) ->
                    start = self.tam.words[dupe[j][0][0]].start
                    end = self.tam.words[dupe[j][0][1]].end
                    TAAPP.origSound.play
                        from: start * 1000.0
                        to: end * 1000.0
                        onstop: ->
                            self.area.focus()
                    event.stopPropagation()
                )
                
            )
        )
        .dropdown()
        
    replaceWords: (c1, c2, w1, w2) ->
        # replace words from c1 to c2 in @words
        # with words w1 through w2 in the original words
        offset = @tam.taIndexSpan[@tam.tas.indexOf @]
        @tam.replaceWords c1 + offset, c2 + offset, w1, w2, @, @words[c1].taPos

class TextAreaManager
    constructor: (@el, @speakers, @words, @current) ->
        @table = $(document.createElement 'table')
            .attr("width", "100%")
            .appendTo(@el)
        
        # create a column for each speaker
        tr = $(document.createElement 'tr')
            .appendTo(@table)
        _.each @speakers, (speaker) =>
            th = document.createElement 'th'
            $(th).html(speaker)
                .width("#{100/@speakers.length}%")
                .appendTo(tr)

        @tas = []
        @taIndexSpan = []
        @areas = []
        @draw()
    
    _tr: (prev) ->
        tr = $(document.createElement 'tr')
        _.each @speakers, (speaker) ->
            td = $(document.createElement('td'))
            tr.append(td)
        
        tr.find("td")
            .width("#{100/@speakers.length}%")
        
        if prev?
            tr.insertAfter(prev)
        else
            tr.appendTo(@table)
            
        tr
    
    _newScriptArea: (name, speaker, index) ->
        ta = new ScriptArea this, name, speaker
        if index?
            @tas.splice(index, 0, ta)
            @areas.splice(index, 0, ta.area)
        else
            @tas.push ta
            @areas.push ta.area
        ta.el
    
    refresh: ->
        @updatePos()
        @adjustHeight()
        @emphasizeWords()
        @insertDupeOverlays @dupes, @dupeInfo
    
    adjustHeight: ->
        # height of scriptareas
        ta.adjustHeight() for ta in @tas

        # update height of row
        for i in [0..@tas.length - 1]
            @table.find('tr').eq(i + 1)
                .height(@tas[i].height())

        # update height of outer element
        console.log "innerheight", window.innerHeight, "offset", @el.offset().top
        @el.height(window.innerHeight - @el.offset().top - 50)

    draw: ->
        @table.find("tr:not(:first)").remove()
        lastSpeaker = @speakers[0]
        count = 0
        @taIndexSpan = [0]
        _.each @current, (word, i) =>
            if i is 0 
                col = 0
                tr = @_tr()
                tr.find("td").eq(col)
                    .append(@_newScriptArea(count++, lastSpeaker))
            else if word.speaker? and word.speaker isnt lastSpeaker
                @taIndexSpan.push i
                col = @speakers.indexOf(word.speaker)
                tr = @_tr()
                tr.find("td").eq(col)
                    .append(@_newScriptArea(count++, word.speaker))
                lastSpeaker = word.speaker

        _.each @taIndexSpan, (start, i) =>
            # update previous text area

            if i is @taIndexSpan.length - 1
                words = @current[start..]
            else
                words = @current[start..@taIndexSpan[i + 1] - 1]

            @tas[i].updateWords words

        @refresh()
        
        @lastFocused = @tas[0]

    pruneByTAPos: (start, end, ta) ->
        match = []
        _.each(ta.words, (word, idx) ->
            console.log word.word, word.taPos
            if word.taPos >= start and word.taPos < end
                match.push idx
            )
        @pruneCurrent(match[0], _.last(match) + 1, ta)
    
    pruneCurrent: (start, end, ta) ->
        taIndex = @tas.indexOf ta
        offset = @taIndexSpan[taIndex]
        @current.splice start + offset, end - start
        
        console.log "offset", offset, "start", start, "end", end
        console.log "current", @current
        
        # update the script area trackers
        for txtarea, i in @tas
            if i > taIndex
                @taIndexSpan[i] -= end - start

        if taIndex is @tas.length - 1
            ta.updateWords @current[@taIndexSpan[taIndex]..]
        else
            ta.updateWords @current\
                [@taIndexSpan[taIndex]..@taIndexSpan[taIndex + 1] - 1]
        
        @refresh()
    
    highlightWords: (start, end) ->
        if start is -1
            @currentHighlight = undefined
            ta.highlights.html("") for ta in @tas
            return
        
        if @currentHighlight?[0] > start and @currentHighlight?[0] < start + 3
            return
        
        @currentHighlight = [start, end]
        
        # find the ta that contains the highlight
        for ta, i in @tas
            if @taIndexSpan[i] > start
                break
        if i isnt 0
            ta = @tas[i - 1]
            offset = @taIndexSpan[i - 1]
        else
            ta = @tas[0]
            offset = @taIndexSpan[0]
            
        t.highlights.html("") for t in @tas

        if end?
            newEnd = end - offset
        
        ta.highlightWords start - offset, newEnd
    
    emphasizeWords: ->
        ta.emphasizeWords() for ta in @tas
        
    updatePos: ->
        @highlightWords -1
        for ta in @tas
            ta.updatePos()
        
        if TAAPP.currentWaveform?
            $(TAAPP.currentWaveform).textAlignedWaveform
                currentWords: @current
    
    clean: (ta) ->
        # assume we'll either have
        # RIGHT WRONG RIGHT
        # or RIGHT WRONG
        # or WRONG RIGHT
        # or RIGHT
        
        tai = @tas.indexOf ta
        offset = @taIndexSpan[tai]
        
        segments = []
        pattern = []
        speakers = []
                
        for word, i in ta.words
            if word.speaker? and word.speaker isnt lastSpeaker
                segments.push i
                speakers.push word.speaker
                pattern.push(word.speaker is ta.speaker)
                lastSpeaker = word.speaker
        
        if pattern.length is 1 and pattern[0]
            @refresh()
            return
        
        if pattern.length is 2 and pattern[0]
            # right wrong
            words = ta.words[segments[1]..]
            if tai is @tas.length - 1
                console.log "New row"
                # new row
                col = @speakers.indexOf(speakers[1])
                tr = @_tr(@table.find('tr').eq(tai + 1))
                tr.find("td").eq(col)
                    .append(@_newScriptArea(@tas.length, speakers[1]))
                
                # update words
                ta.updateWords ta.words[0..segments[1] - 1]
                @tas[@tas.length - 1].updateWords words
                @taIndexSpan.push offset + ta.words.length
                
                @tas[@tas.length - 1].area.setSelection 0, 0
                @refresh()
                
            else if @tas[tai + 1].speaker is speakers[1]
                console.log "Inserting in next row"
                console.log(@tas, tai)
                nextTa = @tas[tai + 1]
                ta.updateWords ta.words[0..segments[1] - 1]
                nextTa.updateWords words.concat(nextTa.words)
                @taIndexSpan[tai + 1] -= words.length
                
                nextTa.area.setSelection 0, 0
                @refresh()
            else
                window.alert "should not get here (right wrong pattern)"
                
            console.log "CLEAN: @tas", @tas, "taIndexSpan", @taIndexSpan
            return
        
        if pattern.length is 2 and pattern[1]
            # wrong right
            words = ta.words[0..segments[1] - 1]
            if tai is 0
                console.log "New row (wrong right)"
                col = @speakers.indexOf speakers[0]
                tr = @_tr(@table.find('tr').eq(tai + 1))
                tr.find("td").eq(col)
                    .append(@_newScriptArea(@tas.length, speakers[0], 0))
                
                # update words
                ta.updateWords ta.words[segments[1]..]
                @tas[0].updateWords words
                @taIndexSpan.splice(1, 0, words.length)
                            
            else if @tas[tai - 1].speaker is speakers[0]
                prevTa = @tas[tai - 1]
                ta.updateWords ta.words[segments[1]..]
                prevTa.updateWords prevTa.words.concat(words)
                @taIndexSpan[tai] += words.length
            else
                window.alert "should not get here (wrong right pattern)"
            ta.area.setSelection(0, 0)
            @refresh()
            return
        
        if pattern.length is 3
            # right wrong right
            words = ta.words[..]
            
            col = @speakers.indexOf speakers[1]
            tr = @_tr(@table.find('tr').eq(tai + 1))
            tr.find("td").eq(col)
                .append(@_newScriptArea(@tas.length, speakers[1], tai + 1))
            
            col = @speakers.indexOf speakers[2]
            tr = @_tr(@table.find('tr').eq(tai + 2))
            tr.find("td").eq(col)
                .append(@_newScriptArea(@tas.length, speakers[2], tai + 2))
            
            # update words
            ta.updateWords words[0..segments[1] - 1]
            @tas[tai + 1].updateWords words[segments[1]..segments[2] - 1]
            @tas[tai + 2].updateWords words[segments[2]..]
            
            @taIndexSpan.splice tai + 1, 0,
                @taIndexSpan[tai] + ta.words.length,
                @taIndexSpan[tai] + ta.words.length + @tas[tai + 1].words.length
            
            @refresh()
            
            @tas[tai + 1].area.setSelection(0, 0)
            return
        
    processDelete: (ta, direction) ->
        if window.TAAPP.sound
            window.TAAPP.sound.stop()

        ta.snapSelectionToWord()
        sel = ta.area.getSelection()
        
        # if nothing is selected, select a word
        if sel.length is 0
            ta.selectWord(direction, true)
        
        sel = ta.area.getSelection()
        end = sel.end
        
        text = ta.area.val()
        while text.charAt(end) is ' '
            end += 1
        
        console.log "calling prune by ta pos with start", sel.start, "end", end
        @pruneByTAPos(sel.start, end, ta)
        
        ta.area.setSelection(sel.start, sel.start)
        @refresh()
    
    insertWords: (indices, pos, ta) ->
        # pos and ta are optional
        ta ?= @lastFocused
        pos ?= ta.area.getSelection().start
        
        # find location
        taIndex = @tas.indexOf ta
        offset = @taIndexSpan[taIndex]

        for word, loc in ta.words
            if word.taPos >= pos
                break
        
        ctx = 
            first: undefined
            last: undefined
            words: @words
            
        if not _.isArray indices
            indices = [indices]
        
        words = _.map indices, ((idx) ->
            if idx.toString().split('-')[0] is '{gp'
                tmp = clone(TAAPP.roomTone[TAAPP.speech]);
                tmp.word = idx
                tmp.pauseLength = parseFloat idx.split('-')[1]
                this.first ?= tmp
                this.last = tmp
                return tmp
                
            tmp = clone(this.words[idx])
            this.first ?= tmp
            this.last = tmp
            return tmp
            ), ctx
        
        # insert them
        args = [loc + offset, 0].concat words
        Array::splice.apply @current, args

        # bookkeeping
        for i in [0..@tas.length - 1]
            if i > taIndex
                @taIndexSpan[i] += words.length
        
        
        # now we have to check everything to make
        # sure we create the right boxes for the
        # right speakers
        
        # well, in a second...
        
        if taIndex is @tas.length - 1
            ta.updateWords @current[@taIndexSpan[taIndex]..]
        else
            ta.updateWords @current[@taIndexSpan[taIndex]..@taIndexSpan[taIndex + 1] - 1]
        
        @clean ta
        @refresh()
        
        # newStart = ctx.first.taPos
        # newEnd = ctx.last.taPos + ctx.last.word.length
        # 
        # [newStart, newEnd]
    
    processPaste: (ta, a) ->
        _.defer =>
            parse_paste = /(?:\[(\d+|gp)\]([^|]+)\|)/g;
            bRes = false
            pastedWords = []
            b = ta.area.val()
            sel = ta.area.getSelection()
            if a.length - b.length + sel.start isnt 0\
            and a.charAt(a.length - b.length + sel.start) isnt ' '\
            and a.charAt(a.length - b.length + sel.start - 1) isnt ' '
                # can't insert here: middle of a word
                ta.area.val(a)
                @refresh()
                return
                
            while result = parse_paste.exec b
                bRes = true
                if result[1] is 'gp'
                    pastedWords.push result[2]
                else
                    pastedWords.push parseInt(result[1], 10)
            
            if bRes
                @insertWords pastedWords, a.length - b.length + sel.start, ta
                console.log "taindexspan after clean", @taIndexSpan
                return
            
            ta.area.val(a)
            @refresh()
    
    processCopy: (ta) ->
        selection = window.getSelection()
        newdiv = document.createElement 'div'
        sel = ta.area.getSelection()
        wrds = ta.range sel.start, sel.end
        
        mod = _.reduce wrds, ((memo, wrd) =>
            if wrd.alignedWord is "gp"
                return memo + '[gp]' + wrd.word + '|';
            for w, j in @words
                if w.start is wrd.start and w.end is wrd.end
                    break
            return "#{memo}[#{j}]#{wrd.word}|"
            ), ""
        
        $(newdiv).css(position: "absolute", left: "-99999px")
            .html(mod)
            .appendTo("body")
        selection.selectAllChildren(newdiv)
        _.defer ->
            $(newdiv).remove()

    processCut: (ta) ->
        sel = ta.area.getSelection()
        wrds = ta.range(sel.start, sel.end)
        newOut = ta.area.val()
        
        mod = _.reduce wrds, ((memo, wrd) =>
            if wrd.alignedWord is "gp"
                return memo + '[gp]' + wrd.word + '|';
            for w, j in @words
                if w.start is wrd.start and w.end is wrd.end
                    break
            return "#{memo}[#{j}]#{wrd.word}|"
            ), ""
        
        newOut = newOut[0..sel.start - 1] + mod + newOut[sel.end + 1..]
        ta.area.val(newOut)
            .setSelection(sel.start, sel.start + mod.length)
    
    insertDupeOverlays: (@dupes, @dupeInfo) ->
        return if not @dupes?
        
        for ta in @tas
            ta.insertDupeOverlays @dupes, @dupeInfo
    
    replaceWords: (c1, c2, w1, w2, ta, pos) ->
        # replace words from c1 to c2 in @current
        # with words w1 through w2 in the original words
        @pruneCurrent c1, c2 + 1, ta
        return @insertWords _.range(w1, w2 + 1), pos, ta
    
    log: (statements...) ->
        args = ["[TAM]"].concat statements
        console.log args...

window.TextAreaManager = TextAreaManager