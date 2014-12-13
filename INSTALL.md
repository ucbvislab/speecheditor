# Installation procedure for speecheditor

This document explains how to set up the text-based speech editor, as seen in [Content-based Tools for Editing Audio Stories](http://vis.berkeley.edu/papers/audiostories).

## Easy method (Vagrant)

Download and install [Vagrant](https://www.vagrantup.com/downloads.html)

Clone the speech editor repository:

```
#!bash
# (> means a prompt on your computer)
> git clone git@bitbucket.org:srubin/speecheditor.git
> cd speecheditor
> git submodule init
> git submodule update
```

In the `/speecheditor` directory, spin up the vagrant enivornment by running

```
#!bash
> vagrant up
```

This will take time: vagrant will set up a virtualmachine with all the requirements necessary to run the speech editor.

Now, to run the speech editor:

```
#!bash
# ssh into your vagrant box
> vagrant ssh

# the /speecheditor is mounted on the vagrant box at /vagrant, so cd to there
# (the $ means a prompt inside the vagrant box)
$ cd /vagrant

# run the speech editor!
$ python app.py
```

To access the speech editor, go to [http://localhost:8080](http://localhost:8080)

See the tutorial for how to use the speech editor at [http://localhost:8080/static/tutorial/index.html](http://localhost:8080/static/tutorial/index.html).

You are free to edit the source code on your computer; everything will
be shared between your main computer and the virtual vagrant box.

If you change the javascript or coffeescript, run

```
#!bash
$ grunt dev
```
inside the vagrant box to regenerate the javascript.

You can exit the ssh session with

```
#!bash
$ exit
```

Once you're done using the speech editor, free up the system resources taken up by the vagrant box by running:

```
#!bash
# from the /speecheditor directory on your computer
> vagrant halt
```

Then, `vagrant up`, `vagrant ssh`, `cd /vagrant` and `python app.py` to start it up again.

## Adding speech tracks

(TODO)

## Enabling the music browser

If you have access to the music browser data files (private access only due to copyrights): put the `musicbrowser` folder inside of `/speecheditor/static`. Also put the `music_browser_app` folder inside of `/speecheditor`. Instead of using `python app.py` run the speech editor with:

```
#!bash
$ python app.py --music-browser
```