#!/usr/bin/env bash

# This file is automatically run during the first `vagrant up`.
# It provisions an ubuntu box with all of the requirements
# necessary to run the speech editor.

curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

apt-get update
apt-get install -y python2.7-dev python-setuptools libsndfile1-dev \
    git gcc build-essential alsa-base flac vorbis-tools python-numpy \
    python-scipy python-matplotlib python-sklearn libsamplerate0-dev \
    libasound2-dev cython lame libboost-program-options-dev nodejs \
    libfreetype6-dev libpng-dev yarn

# Install pip
easy_install pip

# wav2json
# git clone https://github.com/beschulz/wav2json.git w2j && cd w2j && \
#     git checkout 22b676b0f6fe783276f1909f4647a1bc2730bbca && cd .. && \
#     patch w2j/build/Makefile < /vagrant/wav2json.patch && \
#     cd w2j/build && make all && cd ../..
rm -rf w2j && git clone https://github.com/beschulz/wav2json.git w2j && cd w2j && \
    git checkout 22b676b0f6fe783276f1909f4647a1bc2730bbca && cd .. && \
    cd w2j/build && make all && cd ../..
cp /home/vagrant/w2j/bin/Linux/wav2json /usr/local/bin/wav2json

# Install node requirements to build/rebuild the js for the speech editor
# npm install -g npm@latest
# npm install -g grunt-cli
yarn global add grunt-cli
cd /vagrant
# su -c "npm install" vagrant
yarn

