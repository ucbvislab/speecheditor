import functools

import numpy as np

import scikits.audiolab as audiolab

import dataprocessor
from mock_sndfile import MockSndfile

class AudioSource(dataprocessor.Source):
    """Reads samples from an audio file or array.

    Parameters
    ----------
    
    Can be used as a generator that returns sequential lists of nbuf
    samples arguments should be in second (or ms) units, not samples
    (as they are now).
    """
    def __init__(self, filename, start=0, end=None, nbuf=None):
        self.filename = filename
        self.start = start
        self.end = end
        self.nbuf = nbuf

    def __iter__(self):
        if isinstance(self.filename, str):
            f = audiolab.Sndfile(self.filename)
        elif np.iterable(self.filename):
            f = MockSndfile(self.filename, samplerate=44100)
        else:
            raise ValueError, 'Invalid filename: %s' % self.filename

        nbuf = self.nbuf
        end = self.end
        if not end:
            end = f.nframes
        if not nbuf:
            nbuf = 10*f.samplerate

        pos = f.seek(self.start)
        nremaining = end - pos
        while nremaining > 0:
            if nremaining < nbuf:
                nbuf = nremaining
            try:
                yield f.read_frames(nbuf)
                nremaining -= nbuf 
            except RuntimeError:
                nremaining = 0
        f.close()

