import logging
import numpy as np

import basic
import dataprocessor


class PickPeaks(dataprocessor.DataProcessor):
    """Retain local maxima in each incoming frame.

    All other elements are set to zero.
    """
    def process_frame(self, frame):
        lowidx  = np.concatenate(([0], range(len(frame) - 1)))
        highidx = np.concatenate((range(1, len(frame)), [len(frame) - 1]))
        localmax = np.logical_and(frame > frame[lowidx],
                                  frame >= frame[highidx])
        return frame * localmax


def constantqfb(samplerate, nfft, fmin, fmax, bpo=12):
    """Create a Filterbank matrix to combine FFT bins to form the constant Q
    transform.

    Based on B. Blankertz, "The Constant Q Transform"
    http://ida.first.fhg.de/publications/drafts/Bla_constQ.pdf

    Parameters
    ----------
    samplerate : int
        Sampling rate of the incoming signal.
    nfft : int
        FFT length to use.
    fmin : float
        Frequency in Hz of the lowest edge of the Mel bands. Defaults to 0.
    fmax : float
        Frequency in Hz of the upper edge of the Mel bands. Defaults
        to `samplerate` / 2.
    bpo : int
        Number of bins per octave.
    """
    Q = 1 / (2 ** (1.0 / bpo) - 1)

    #nfft = 2 ** np.ceil(np.log2(np.ceil(Q * samplerate / fmin)))
    # Compute minimum fmin from nfft.
    if fmin < Q * samplerate / nfft:
        fmin = Q * samplerate / nfft
        logging.warning('fmin too small for nfft, increasing to %.2f' % fmin)
        
    K = np.ceil(bpo * np.log2(float(fmax) / fmin))
    
    tempkernel = np.zeros(nfft)
    kernel = np.zeros((K, nfft / 2 + 1), dtype=np.complex)
    for k in np.arange(K-1, -1, -1, dtype=np.float):
        ilen = np.ceil(Q * samplerate / (fmin * 2.0**(k / bpo)))
        if ilen % 2 == 0:
            # calculate offsets so that kernels are centered in the
            # nfftgth windows
            start = nfft / 2 - ilen / 2
        else:
            start = nfft / 2 - (ilen + 1) / 2        

        tempkernel[:] = 0
        tempkernel[start:start+ilen] = (np.hamming(ilen) / ilen
                                        * np.exp(2 * np.pi * 1j * Q
                                                 * np.r_[:ilen] / ilen))
        kernel[k] = np.fft.rfft(tempkernel)
    return kernel / nfft


class ConstantQToChroma(dataprocessor.DataProcessor):
    """Convert a constant Q spectrogram to a chromagram.

    Folds all octaves in the constant Q spectrogram down to an
    octave-invariant pitch class profile representation.

    Attributes
    ----------
    bpo : int
        Number of bins per octave.
    """
    def __init__(self, bpo=12):
        self.bpo = bpo
        
    def process_frame(self, cqframe):
        hpcp = np.zeros(self.bpo)
        for n in xrange(0, len(cqframe), self.bpo):
            cqoct = cqframe[n:n+self.bpo]
            hpcp[:len(cqoct)] += cqoct
        return hpcp


def CQT(samplerate, nfft, nwin=None, nhop=None, winfun=np.hamming,
        fmin=55.0, fmax=587.36, bpo=12):
    """Constant Q transform.

    Parameters
    ----------
    samplerate : int
        Sampling rate of the incoming signal.
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
    fmin : float
        Frequency in Hz of the lowest edge of the Mel bands. Defaults to 0.
    fmax : float
        Frequency in Hz of the upper edge of the Mel bands. Defaults
        to `samplerate` / 2.
    bpo : int
        Number of bins per octave.
    """
    CQ = constantqfb(samplerate, nfft, fmin, fmax, bpo)
    return dataprocessor.Pipeline(basic.STFT(nfft, nwin, nhop, winfun),
                                  basic.Filterbank(CQ))


def CQChroma(samplerate, nfft, nwin=None, nhop=None, winfun=np.hamming,
             fmin=55.0, fmax=587.36, nchroma=12):
    """Compute chroma features using the constant Q transform.

    Parameters
    ----------
    samplerate : int
        Sampling rate of the incoming signal.
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
    fmin : float
        Frequency in Hz of the lowest edge of the Mel bands. Defaults to 0.
    fmax : float
        Frequency in Hz of the upper edge of the Mel bands. Defaults
        to `samplerate` / 2.
    nchroma : int
        Number of chroma dimensions to return (number of bins per octave).

    See Also
    --------
    CQT : Constant Q transform
    Chroma : Alternate implementation of chroma features
    """
    return dataprocessor.Pipeline(CQT(samplerate, nfft, nwin, nhop, winfun,
                                      fmin, fmax, nchroma),
                                  basic.Abs(),
                                  ConstantQToChroma(nchroma))

def _hz2octs(freq, A440):
    return np.log2(freq / (A440 / 16.0))

def chromafb(samplerate, nfft, nchroma, A440=440.0, ctroct=5.0, octwidth=0):
    """Create a Filterbank matrix to convert FFT to Chroma.

    Based on Dan Ellis's fft2chromamx.m

    Parameters
    ----------
    samplerate : int
        Sampling rate of the incoming signal.
    nfft : int
        FFT length to use.
    nchroma : int
        Number of chroma dimensions to return (number of bins per octave).
    A440 : float
        Reference frequency in Hz for A.  Defaults to 440.
    ctroct, octwidth : float
        These parameters specify a dominance window - Gaussian
        weighting centered on ctroct (in octs, re A0 = 27.5Hz) and
        with a gaussian half-width of octwidth.  Defaults to
        halfwidth = inf i.e. flat.
    """
    wts = np.zeros((nchroma, nfft))

    fftfrqbins = nchroma * _hz2octs(np.arange(1, nfft, dtype='d') / nfft
                                    * samplerate, A440)

    # make up a value for the 0 Hz bin = 1.5 octaves below bin 1
    # (so chroma is 50% rotated from bin 1, and bin width is broad)
    fftfrqbins = np.concatenate(([fftfrqbins[0] - 1.5 * nchroma], fftfrqbins))

    binwidthbins = np.concatenate(
        (np.maximum(fftfrqbins[1:] - fftfrqbins[:-1], 1.0), [1]))

    D = np.tile(fftfrqbins, (nchroma,1))  \
        - np.tile(np.arange(0, nchroma, dtype='d')[:,np.newaxis], (1,nfft))

    nchroma2 = round(nchroma / 2.0);

    # Project into range -nchroma/2 .. nchroma/2
    # add on fixed offset of 10*nchroma to ensure all values passed to
    # rem are +ve
    D = np.remainder(D + nchroma2 + 10*nchroma, nchroma) - nchroma2;

    # Gaussian bumps - 2*D to make them narrower
    wts = np.exp(-0.5 * (2*D / np.tile(binwidthbins, (nchroma,1)))**2)

    # normalize each column
    wts /= np.tile(np.sqrt(np.sum(wts**2, 0)), (nchroma,1))

    # Maybe apply scaling for fft bins
    if octwidth > 0:
        wts *= np.tile(
            np.exp(-0.5 * (((fftfrqbins/nchroma - ctroct)/octwidth)**2)),
            (nchroma, 1))

    # remove aliasing columns
    return wts[:,:nfft/2+1]


def Chroma(samplerate, nfft, nwin=None, nhop=None, winfun=np.hamming, nchroma=12,
           center=1000, sd=1):
    """Compute chroma features using the constant Q transform.

    Parameters
    ----------
    samplerate : int
        Sampling rate of the incoming signal.
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
    nchroma : int
        Number of chroma dimensions to return (number of bins per octave).
    center : int
    sd : int

    See Also
    --------
    CQChroma : Alternate implementation of chroma features based on
               the constant Q transform.
    """
    A0 = 27.5  # Hz
    A440 = 440.0 # Hz
    f_ctr_log = np.log2(center/A0)
    CM = chromafb(samplerate, nfft, nchroma, A440, f_ctr_log, sd)

    return dataprocessor.Pipeline(basic.STFT(nfft, nwin, nhop, winfun),
                                  basic.Abs(),
                                  PickPeaks(),
                                  basic.Filterbank(CM))


class CircularShift(dataprocessor.DataProcessor):
    """Circularly shift elements of each incoming frame.

    Elements shifted past the end of the array are placed at the
    beginning.

    Attributes
    ----------
    nshift : int
        Number of places to shift.  Defaults to 0 (no op).

    See Also
    --------
    numpy.roll
    """
    def __init__(self, nshift=0):
        self.nshift = nshift
        
    def process_frame(self, frame):
        return frame[np.r_[self.nshift:len(frame), :self.nshift]]

