# Installation procedure for speecheditor

This document explains how to set up the text-based speech editor, as seen in [Content-based Tools for Editing Audio Stories](http://vis.berkeley.edu/papers/audiostories).

## Easy method (Vagrant)

Download and install [Vagrant](https://www.vagrantup.com/downloads.html)

Clone the speech editor repository:

`git clone git@bitbucket.org:srubin/speecheditor.git` 

In the `/speecheditor` directory, spin up the vagrant enivornment by running `vagrant up`. This will take time: vagrant will set up a virtualmachine with all the requirements necessary to run the speech editor.

Now, to run the speech editor:

```
#!bash
# ssh into your vagrant box
vagrant ssh

# the /speecheditor is mounted on the vagrant box at /vagrant, so cd to there
cd /vagrant

# run the speech editor!
python app.py
```

You are free to edit the source code on your computer; everything will
be shared between your main computer and the virtual vagrant box.

If you change the javascript or coffeescript, run `grunt dev` inside
the vagrant box to regenerate the javascript.