import numpy as np
import scipy as sp

import basic
import dataprocessor

def MelSpec(samplerate, nfft, nwin=None, nhop=None, winfun=np.hamming,
         nmel=40, width=1.0, fmin=0, fmax=None):
    """Mel-frequency power spectrum.

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
    nmel : int
        Number of Mel bands to use.
    width : float
        The constant width of each band relative to standard Mel. Defaults 1.0.
    fmin : float
        Frequency in Hz of the lowest edge of the Mel bands. Defaults to 0.
    fmax : float
        Frequency in Hz of the upper edge of the Mel bands. Defaults
        to `samplerate` / 2
    
    See Also
    --------
    STFT : Short-time Fourier transform.
    """
    FB = melfb(samplerate, nfft, nmel, width, fmin, fmax) 
    return dataprocessor.Pipeline(basic.PowSpec(nfft, nwin, nhop, winfun),
                                  basic.Filterbank(FB))


def _hz_to_mel(f):
    return 2595.0 * np.log10(1 + f / 700.0)

def _mel_to_hz(z):
    return 700.0 * (10.0**(z / 2595.0) - 1.0)

def melfb(samplerate, nfft, nfilts=40, width=1.0, fmin=0, fmax=None):
    """Create a Filterbank matrix to combine FFT bins into Mel-frequency bins.

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
    nmel : int
        Number of Mel bands to use.
    width : float
        The constant width of each band relative to standard Mel. Defaults 1.0.
    fmin : float
        Frequency in Hz of the lowest edge of the Mel bands. Defaults to 0.
    fmax : float
        Frequency in Hz of the upper edge of the Mel bands. Defaults
        to `samplerate` / 2.

    See Also
    --------
    Filterbank
    MelSpec
    """

    if fmax is None:
        fmax = samplerate / 2

    wts = np.zeros((nfilts, nfft / 2 + 1))
    # Center freqs of each FFT bin
    fftfreqs = np.arange(nfft / 2 + 1, dtype=np.double) / nfft * samplerate

    # 'Center freqs' of mel bands - uniformly spaced between limits
    minmel = _hz_to_mel(fmin)
    maxmel = _hz_to_mel(fmax)
    binfreqs = _mel_to_hz(minmel
                          + np.arange((nfilts+2), dtype=np.double) / (nfilts+1)
                          * (maxmel - minmel))

    for i in xrange(nfilts):
        freqs = binfreqs[i + np.arange(3)]
        # scale by width
        freqs = freqs[1] + width * (freqs - freqs[1])
        # lower and upper slopes for all bins
        loslope = (fftfreqs - freqs[0]) / (freqs[1] - freqs[0])
        hislope = (freqs[2] - fftfreqs) / (freqs[2] - freqs[1])
        # .. then intersect them with each other and zero
        wts[i,:] = np.maximum(0, np.minimum(loslope, hislope))

    # Slaney-style mel is scaled to be approx constant E per channel
    #enorm = 2.0 / (binfreqs[2:nfilts+2] - binfreqs[:nfilts])
    #wts = np.dot(np.diag(enorm), wts)
    
    return wts


def dctfb(ndct, nrow):
    """Create a DCT (type 3) matrix.

    Parameters
    ----------
    ndct : int
        Number of DCT components.
    nrow : int
        Number of rows.
    """
    DCT = np.empty((ndct, nrow))
    for i in xrange(ndct):
        DCT[i,:] = (np.cos(i*np.arange(1, 2*nrow, 2) / (2.0*nrow) * np.pi)
                    * np.sqrt(2.0 / nrow))
    return DCT


def MFCC(samplerate, nfft, nwin=None, nhop=None, winfun=np.hamming,
         nmel=40, width=1.0, fmin=0, fmax=None, ndct=13):
    """Mel-frequency Cepstral Coefficients

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
    nmel : int
        Number of Mel bands to use.
    width : float
        The constant width of each band relative to standard Mel. Defaults 1.0.
    fmin : float
        Frequency in Hz of the lowest edge of the Mel bands. Defaults to 0.
    fmax : float
        Frequency in Hz of the upper edge of the Mel bands. Defaults
        to `samplerate` / 2
    ndct : int
        Number of DCT components (cepstra) to return.
    
    See Also
    --------
    MelSpec : Mel-frequency power spectrum.
    """
    DCT = dctfb(ndct, nmel)
    return dataprocessor.Pipeline(
        MelSpec(samplerate, nfft, nwin, nhop, winfun, nmel, width, fmin, fmax),
        basic.Log(),
        basic.Filterbank(DCT))


class Stack(dataprocessor.DataProcessor):
    """Stack output of multiple DataProcessors.

    Stacks the result of running multiple DataProcessors on a single
    frame into a compound feature vector.

    Attributes
    ----------
    dps : list of DataProcessor objects to stack
    """
    def __init__(self, *dps):
        self.dps = dps

    def process_frame(self, frame):
        output = []
        for dp in self.dps:
            output.append(dp.process_frame(frame))
        return np.asarray(output)


class NoOp(dataprocessor.DataProcessor):
    def process_frame(self, frame):
        return frame

class Delta(dataprocessor.DataProcessor):
    def __init__(self):
        pass

# def mfcc_d_a():
#     s = stack(3)
#     mfcc(broadcast(nop(s), delta(broadcast(nop(s), delta(s)))))

