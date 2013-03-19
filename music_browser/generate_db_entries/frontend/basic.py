from __future__ import division

import types

import numpy as np
import scipy as sp

import scikits.samplerate as samplerate

import dataprocessor
from externaldps import *

class Resample(dataprocessor.DataProcessor):
    """Resamples input using scikits.samplerate.

    Attributes
    ----------
    ratio : float
        Resampling ratio.  For best results len(frame)*ratio should be
        an integer.
    type : str
        resample type (see scikits.samplerate.resample)
    verbose : bool

    See Also
    --------
    scikits.samplerate.resample
    """
    def __init__(self, ratio=None, type='sinc_fastest', verbose=False):
        self.ratio = ratio
        self.type = type
        self.verbose = verbose

    def process_frame(self, frame):
        if self.ratio is None:
            return frame
        else:
            return samplerate.resample(frame, self.ratio, self.type,
                                       self.verbose)


class Normalize(dataprocessor.DataProcessor):
    """Normalize each frame using a norm of the given order.

    Attributes
    ----------
    ord : see numpy.linalg.norm
        Order of the norm.

    See Also
    --------
    numpy.linalg.norm
    """
    def __init__(self, ord=None):
        self.ord = ord

    def process_frame(self, frame):
        return frame / (np.linalg.norm(frame, self.ord) + 1e-16)


class Mono(dataprocessor.DataProcessor):
    """Convert multichannel frames to mono.

    Takes the mean across all channels.
    """
    def process_frame(self, frame):
        if frame.ndim > 1:
            mono_frame = frame.mean(1)
        elif np.shape(frame) == (2,):
            mono_frame = frame.mean()
        else:
            mono_frame = frame
        return mono_frame


#class Preemphasize(dataprocessor.DataProcessor):  # or just filter()
#    pass


# essentially a simple buffer - works for matrices too... (really row features)
class Framer(dataprocessor.DataProcessor):
    """Turn an arbitrary length sequence of samples into regularly spaced frames.
    
    Handles zero padding of final frames.

    Attributes
    ----------
    nwin : int
        Length of frame (window) in samples.
    nhop : int
        Number of samples to skip between adjacent frames (hopsize).
        Defaults to `nwin`.

    See Also
    --------
    OverlapAdd : Inverse of Framer.
    """
    def __init__(self, nwin, nhop=None):
        self.nwin = nwin
        if nhop is None:
            nhop = nwin
        self.nhop = nhop

    def process_sequence(self, samples):
        # Is samples a list instead of a generator?
        if not 'next' in dir(samples):
            samples = (x for x in [samples])
    
        # nhop cannot be less than 1 for normal behavior
        noverlap = self.nwin - self.nhop
        
        buf = samples.next().copy()
        while len(buf) < self.nwin:
            buf = np.concatenate((buf, samples.next()))
      
        frame = buf[:self.nwin]
        buf = buf[self.nwin:]

        while True:
            yield frame.copy()
            frame[:noverlap] = frame[self.nhop:]
            
            try:
                while len(buf) < self.nhop:
                    buf = np.concatenate((buf, samples.next()))
            except StopIteration:
                break
    
            frame[noverlap:] = buf[:self.nhop]
            buf = buf[self.nhop:]

        # Read remaining few samples from file and yield the remaining
        # zero padded frames.
        frame[noverlap:noverlap + len(buf)] = buf
        frame[noverlap + len(buf):] = 0
        nremaining_frames = int(np.ceil((1.0*noverlap + len(buf)) / self.nhop))

        for n in xrange(nremaining_frames):
            yield frame.copy()
            frame[:noverlap] = frame[self.nhop:]
            frame[noverlap:] = 0


class OverlapAdd(dataprocessor.DataProcessor):
    """Perform overlap-add resynthesis of a sequence of frames.

    Inverse of Framer().

    Attributes
    ----------
    nwin : int
        Length of frame (window) in samples.
    nhop : int
        Number of samples to skip between adjacent frames (hopsize).
        Defaults to `nwin`.

    See Also
    --------
    Framer
    """
    def __init__(self, nwin=512, nhop=None):
        self.nwin = nwin
        if nhop is None:
            nhop = nwin
        self.nhop = nhop

    def process_sequence(self, frames):
        # nhop cannot be less than 1 for normal behavior
        noverlap = self.nwin - self.nhop

        # off by one error somewhere here
        buf = np.zeros(self.nwin)
        for frame in frames:
            buf += frame
            yield buf[:self.nhop].copy()
            buf[:noverlap] = buf[self.nhop:]
            buf[noverlap:] = 0

        nremaining_frames = int(noverlap / self.nhop) - 1
        for n in range(nremaining_frames):
            yield buf[:self.nhop].copy()
            buf[:noverlap] = buf[self.nhop:]


class Window(dataprocessor.DataProcessor):
    """Multiply frames by a constant window function.

    Attributes
    ----------
    winfun : function of the form fun(winlen), returns array of length winlen
        Function to generate a window of a given length.  Defaults to
        numpy.hamming.

    See Also
    --------
    numpy.hamming : Hamming window function
    numpy.ones : Rectangular window function
    """
    def __init__(self, winfun=np.hanning):
        self.winfun = winfun

    def process_sequence(self, frames):
        win = None
        for frame in frames:
            if win is None:
                win = self.winfun(len(frame))
            yield win * frame


class RMS(dataprocessor.DataProcessor):
    """Compute root-mean-square energy in decibels of each frame in sequence."""
    def process_frame(self, frame):
        return 20*np.log10(np.sqrt(np.mean(frame**2)))


class DB(dataprocessor.DataProcessor):
    """Convert frames to decibels.

    Attributes
    ----------
    minval : float
        All values below minval are clipped to minval.

    See Also
    --------
    IDB
    """
    def __init__(self, minval=-100.0):
        self.minval = minval

    def process_frame(self, frame):
        spectrum = 20*np.log10(np.abs(frame))
        spectrum[spectrum < self.minval] = self.minval
        return spectrum


class IDB(dataprocessor.DataProcessor):
    """Convert frames from decibels to linear units.

    Inverse of DB.

    See Also
    --------
    DB
    """
    def process_frame(self, frame):
        return 10.0 ** (frame / 20)


class Log(dataprocessor.DataProcessor):
    """Take the logarithm of each frame.

    Attributes
    ----------
    minval : float
        All values below minval are clipped to minval.
    """
    def __init__(self, minval=-5.0):
        self.minval = minval

    def process_frame(self, frame):
        return np.maximum(np.log(frame), self.minval)


class Filterbank(dataprocessor.DataProcessor):
    """Warp STFT frames by passing them through the given filterbank.

    Attributes
    ----------
    fb : array_like
        Matrix of filterbank weights.  Each incoming frame is
        multiplied by this matrix.
    """
    def __init__(self, fb):
        self.fb = fb
        
    def process_frame(self, frame):
        return np.dot(self.fb, frame)


# compound feature extractors:

def STFT(nfft, nwin=None, nhop=None, winfun=np.hanning):
    """Compute the Short-time Fourier Transform of incoming samples.

    Parameters
    ----------
    nfft : int
        FFT length to use.
    nwin : int
        Length of each window in samples.  Defaults to `nfft`.
    nhop : int
        Number of samples to skip between adjacent frames (hopsize).
        Defaults to `nwin`.
    winfun : function of the form fun(winlen), returns array of length winlen
        Function to generate a window of a given length.  Defaults to
        numpy.hamming.

    See Also
    --------
    ISTFT : Inverse STFT.
    """
    if nwin is None:
        nwin = nfft
    return dataprocessor.Pipeline(Framer(nwin, nhop), Window(winfun),
                                  RFFT(nfft))


def ISTFT(nfft, nwin=None, nhop=None, winfun=np.hanning):
    """Compute inverse Short-time Fourier Transform of incoming frames.

    Parameters
    ----------
    nfft : int
        FFT length to use.
    nwin : int
        Length of each window in samples.  Defaults to `nfft`.
    nhop : int
        Number of samples to skip between adjacent frames (hopsize).
        Defaults to `nwin`.
    winfun : function of the form fun(winlen), returns array of length winlen
        Function to generate a window of a given length.  Defaults to
        numpy.hamming.

    See Also
    --------
    STFT : Forward STFT.
    """
    if nwin is None:
        nwin = nfft
    return dataprocessor.Pipeline(IRFFT(nfft), Window(winfun),
                                  OverlapAdd(nwin, nhop))


def LogSpec(nfft, nwin=None, nhop=None, winfun=np.hanning):
    """Compute the log power spectrum of incoming samples in decibels.

    Parameters
    ----------
    nfft : int
        FFT length to use.
    nwin : int
        Length of each window in samples.  Defaults to `nfft`.
    nhop : int
        Number of samples to skip between adjacent frames (hopsize).
        Defaults to `nwin`.
    winfun : function of the form fun(winlen), returns array of length winlen
        Function to generate a window of a given length.  Defaults to
        numpy.hamming.

    See Also
    --------
    STFT : Short-time Fourier transform.
    """
    return dataprocessor.Pipeline(STFT(nfft, nwin, nhop, winfun), DB())


def PowSpec(nfft, nwin=None, nhop=None, winfun=np.hanning):
    """Compute the power spectrum of incoming samples.

    Parameters
    ----------
    nfft : int
        FFT length to use.
    nwin : int
        Length of each window in samples.  Defaults to `nfft`.
    nhop : int
        Number of samples to skip between adjacent frames (hopsize).
        Defaults to `nwin`.
    winfun : function of the form fun(winlen), returns array of length winlen
        Function to generate a window of a given length.  Defaults to
        numpy.hamming.

    See Also
    --------
    STFT : Short-time Fourier transform.
    """
    return dataprocessor.Pipeline(STFT(nfft, nwin, nhop, winfun), Abs(),
                                  # Normalize(ord=1),
                                  Square())
