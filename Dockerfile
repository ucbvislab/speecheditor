FROM ubuntu

# Install python setuptools
RUN DEBIAN_FRONTEND=noninteractive apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y python2.7-dev python-setuptools libsndfile1-dev sox git gcc build-essential
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y alsa-base flac vorbis-tools

# Install scipy stack
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y python-numpy python-scipy python-matplotlib python-sklearn
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y libsamplerate0-dev libasound2-dev cython lame

# Install pip
RUN easy_install pip

# wav2json
RUN apt-get install -y libboost-program-options-dev
RUN git clone https://github.com/beschulz/wav2json.git
ADD wav2json.patch /wav2json.patch
RUN patch wav2json/build/Makefile < wav2json.patch
#ENV LD_LIBRARY_PATH /usr/lib/x86_64-linux-gnu/
#RUN ln -s /usr/lib/x86_64-linux-gnu/libboost_program_options.so.1.54.0 /usr/lib/x86_64-linux-gnu/libboost_program_options.so.1.42.0'
RUN cd wav2json/build && make all && cd ../..
ENV PATH /wav2json/bin/Linux/:$PATH


# Install python module requirements
ADD requirements.txt /src/requirements.txt
RUN cd /src; pip install -r requirements.txt

# bundle app source
ADD . /src

# expose
EXPOSE 5000

# run
CMD ["python", "/src/app.py"]
WORKDIR /src