# Installation procedure for speecheditor

This document explains how to set up the text-based speech editor, as seen in [Content-based Tools for Editing Audio Stories](http://vis.berkeley.edu/papers/audiostories).

## Easy method (Vagrant)

Download and install [Vagrant](https://www.vagrantup.com/downloads.html)

Download and install [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (or possibly another Vagrant host like VMWare Fusion).

Clone the speech editor repository:

```bash
# (> means a prompt on your computer)
> git clone https://github.com/ucbvislab/speecheditor.git
> cd speecheditor
> git submodule init
> git submodule update
```

In the `/speecheditor` directory, spin up the vagrant enivornment by running

```bash
> vagrant up
```

This will take time: vagrant will set up a virtualmachine with all the requirements necessary to run the speech editor.

Now, to run the speech editor:

```bash
# ssh into your vagrant box
> vagrant ssh

# the /speecheditor is mounted on the vagrant box at /vagrant, so cd to there
# (the $ means a prompt inside the vagrant box)
$ cd /vagrant

# install python requirements
$ pip install -r requirements.txt

# run the speech editor!
$ python app.py
```

To access the speech editor, go to [http://localhost:8080](http://localhost:8080) in **Chrome only**.

See the tutorial for how to use the speech editor at [http://localhost:8080/static/tutorial/index.html](http://localhost:8080/static/tutorial/index.html).

You are free to edit the source code on your computer; everything will
be shared between your main computer and the virtual vagrant box.

If you change the javascript or coffeescript, run

```bash
$ grunt dev
```
inside the vagrant box to regenerate the javascript.

You can exit the ssh session with

```bash
$ exit
```

Once you're done using the speech editor, free up the system resources taken up by the vagrant box by running:

```bash
# from the /speecheditor directory on your computer
> vagrant halt
```

Then, `vagrant up`, `vagrant ssh`, `cd /vagrant` and `python app.py` to start it up again.

## Adding speech tracks

There is a bit more setup you need to do to add your own speech tracks to the speech editor.

### Setup

You need to get HTK 3.4. First, register here: http://htk.eng.cam.ac.uk/register.shtml

Once you have a username and password, run this in the vagrant box:

```bash
$ sh alignment-setup.sh
```

This will prompt you for your HTK username and password. It will then download and install HTK 3.4 and p2fa-vislab (a wrapper for HTK's HVite).

### Analyzing your tracks

Once you have successfully run `alignment-setup.sh`, you can analyze your own speech tracks.

Add your new speech track mp3 file at `/speecheditor/static/speechtracks/{track-name}.mp3`. Also add the text transcript of the speech track at `/speecheditor/static/speechtracks/{track-name}.txt`. Then, in the vagrant box, run

```bash
$ cd vagrant
$ python analyze_speech.py {track-name}
```

Once this finished (note: it may take a while if the speech is long), your track will show up in the new composition dialog in the speech editor.

## Enabling the music browser

If you have access to the music browser data files (private access only due to copyrights): put the `musicbrowser` folder inside of `/speecheditor/static`. Also put the `music_browser_app` folder inside of `/speecheditor`. Instead of using `python app.py` run the speech editor with:

```bash
$ python app.py --music-browser
```
