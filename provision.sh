#!/usr/bin/env bash
apt-add-repository ppa:chris-lea/node.js
apt-get update
apt-get install -y python2.7-dev python-setuptools libsndfile1-dev git gcc build-essential alsa-base flac vorbis-tools python-numpy python-scipy python-matplotlib python-sklearn libsamplerate0-dev libasound2-dev cython lame libboost-program-options-dev nodejs

# Install pip
easy_install pip

# wav2json
git clone https://github.com/beschulz/wav2json.git w2j && \
    patch w2j/build/Makefile < /vagrant/wav2json.patch && \
    cd w2j/build && make all && cd ../.. && \
    ln -s ~/w2j/bin/Linux/wav2json /usr/local/bin/wav2json

# Install python module requirements
pip install -r /vagrant/requirements.txt

# Install node requirements to build/rebuild the js for the speech editor
npm install -g npm@latest
npm install -g grunt-cli
cd /vagrant
npm install
