FROM ubuntu
RUN DEBIAN_FRONTEND=noninteractive apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y python2.7-dev python-setuptools libsndfile1-dev git gcc build-essential alsa-base flac vorbis-tools python-numpy python-scipy python-matplotlib python-sklearn libsamplerate0-dev libasound2-dev cython lame libboost-program-options-dev

# Install pip
RUN easy_install pip

# wav2json
RUN git clone https://github.com/beschulz/wav2json.git
ADD wav2json.patch /wav2json.patch
RUN patch wav2json/build/Makefile < wav2json.patch
RUN cd wav2json/build && make all && cd ../..
ENV PATH /wav2json/bin/Linux/:$PATH

# Install python module requirements
ADD requirements.txt /src/requirements.txt
RUN cd /src; pip install -r requirements.txt

# expose
EXPOSE 5000

# bundle app source
#ADD . /src

# run
#CMD ["python", "/src/app.py"]
WORKDIR /src