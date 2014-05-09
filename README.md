#Integrated Radio/Audio Editor

## Tools

### Text-based speech editor

* Text/speech alignment
* Standard cut/copy/paste/delete metaphors
* Pause and breath identification and insertion
* Duplicate sentence detection

### Music selection

### Music remixing

# Architecture

The speech editor app has the client/server model. The client--the
javascript web app--is responsible for all of the interaction. As you
edit the speech, the web app changes the underlying state of the audio
composition. Then, to actually generate the audio for the composition,
the web app sends a request to the server (`/reauthor`) to build the
audio.

## Components

### `textareatest.js` - main front-end javascript code

Defines `TAAPP`, a global variable that controls the state of the app.
Key functions of `TAAPP` include `loadSite`, `newProject`,
`generateAudio`, `createUnderlay`, and `drawScript`. Most of the
functions in this file have fairly descriptive names.

Here are the key things that happen when the site loads (this can be
found at the end of the file):

```javascript
// launch the project creation modal dialog
$('#setupModal')
.modal({
    show: (speech === "")
})
.find('.createProjectBtn')
.click(function () {
    TAAPP.newProject();
});

// start a new project if it was specified in the url
if (speech !== "") {
    TAAPP.newProject(speech);
}

// initialize everything that doesn't depend on the speech track
TAAPP.loadSite();
```

### `edible` - timeline and waveform plugin

`edible` is a jquery-ui plugin that I wrote to represent the waveforms
and timeline in the interface. There are a few different kinds of
waveforms in the app: `edible.musicWaveform.js`,
`edible.textAlignedWaveform.js`, `edible.waveform.js`, all of which
inherit from `edible.wfBase.js`. There's also `edible.timeline.js`,
which is the timeline itself.

The waveforms are rendered as html5 canvas objects.

### `textAreaManager.coffee` - manage the text areas that contain speech

`textAreaManager` (often referred to as TAM throughout the code)
manages the text areas in the UI. These contain the text that can be
edited. It's responsible for editing and highlighting the text as the
audio plays.

You can, for example, see the keyboard shortcuts defined in the
`ScriptArea` constructor. This gives you a sense of what you can do
within a textarea.

The `TAM` is created in the `TAAPP.reset` function in
`textareatest.js`.

### `musicbrowser` - sub-app for the music browser

This folder contains the entire music browser app.

### `app.py` - python back-end

This is the main server for the web app. Its primary functions are to
serve the static web app pages, and to generate audio (and do any
intense background processing, like music retargeting).

* `/`: serves the main web app (index.html)
* `/reauthor`: generates the complete audio for the edited story
  (activated by rendering/pressing play/pressing `enter` in the web
  app)
* `/download/<name>`: used to download generated audio (activated by
  download button in web app)
* `/dupes`: detect duplicate lines in script (activated when a script
  is loaded in the web app)
* `/changepoints/<song_name>`: finds music change points in a song
* `/underlayRetarget...`: generates a retargeted musical underlay for
  the story
* `/uploadSong`: uploads and analyzes a song
* `/alignment/<name>`: return the pre-computed transcript-to-speech
  alignment for the speech track