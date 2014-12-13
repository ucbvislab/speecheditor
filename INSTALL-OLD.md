# OLD INSTRUCTIONS (Hard method)

## This will take a long time to set up

It will, unfortunately, take a while to install all of the
dependencies. This interface is research code so ease-of-setup was
never one of its goals.

## Play with the interface without installation

If you want to play around with the system _without_ installing it, please visit: [http://voicebox.eecs.berkeley.edu/speecheditor/?speech=bluesmobile-interview](http://voicebox.eecs.berkeley.edu/speecheditor/?speech=bluesmobile-interview) in *Chrome*. Username: audio, password: editor.

See the tutorial for how to use the system here: [http://voicebox.eecs.berkeley.edu/speecheditor/static/tutorial/](http://voicebox.eecs.berkeley.edu/speecheditor/static/tutorial/)

## Old radiotool

This project uses an old version of my python audio library `radiotool`. The current version has many bug fixes and lots of new features: `https://github.com/ucbvislab/radiotool` (newest features are on the `constraints` branch). I'm not going to update this project right now to use the newest version of radiotool, but if you want to do any related work, please use the newest version of radiotool.

## Installation

Initialize submodules in the git repo: `git submodule update --init`

Install XCode through the Mac App Store

Install the OSX Command Line Tools: `xcode-select --install`

Install node.js: [http://nodejs.org/download/](http://nodejs.org/download/)

If you're on a Mac, install homebrew: `ruby -e "$(curl -fsSL https://raw.github.com/Homebrew/homebrew/go/install)"`

Install grunt-cli: `sudo npm install -g grunt-cli`

Install libsndfile: `brew install libsndfile`

Install boost: `brew install boost`

Install wav2json: `cd wav2json/build && make all`

Add wav2json to your path: `mv ../bin/Darwin/wav2json /usr/local/bin`

Install virtualenv: `sudo pip install virtualenv`

Create a new Python virtual environment: `virtualenv speecheditor_env`

Activate the virtual environment: `source speecheditor_env/bin/activate`

Note: make sure you do all of the following steps within the
`speecheditor_env` virtual environment.

Install the python requirements: `for line in $(cat requirements.txt); do pip install $line; done`

## Running the editor

In the virtual environment, run `python app.py --no-browser`

If you change the javascript or coffeescript, run `grunt dev` to
regenerate the javascript. Alternatively, you can  uncomment lines
254-274 in templates/index.html and comment line 276. This will let
you load everything while making changes to the
coffeescript/javascript without re-running `grunt dev`.

The music browser won't work. To get the browser to work, you need to
set up a mysql database and load it with the appropriate data-- I can
explain this in more detail later, but in general, the music browser
is not integral to the rest of the app.