# Compute the audio novelty features of a song

import sys
import wave
import struct

import numpy as N
import scipy.spatial.distance as scidist
import scipy.signal


def s2m(seconds):
    minutes = int(seconds / 60)
    seconds = seconds - 60 * minutes
    ms = seconds - int(seconds)
    return "%02d:%05.2f" % (minutes, seconds)


def RMS_energy(frames):
    f = frames.flatten()
    return N.sqrt(N.mean(f * f))


def readwav(wavfile):
    if wavfile.getsampwidth() != 2:
        raise IOError("Input must be a 16-bit wave file")
    # read a 16-bit wave file
    rawdata = wavfile.readframes(wavfile.getnframes())
    # convert bytes to floats (< implies little-endian)
    return (N.array(struct.unpack('<' + str(2 * wavfile.getnframes()) + 'h',
           rawdata), dtype=N.double) / 32768).reshape(-1, 2)
        

def novelty(filename, k=64, wlen_ms=100, duration=-1, start=0, nchangepoints=5):
    song = wave.open(filename, 'r')

    wlen_samples = wlen_ms * song.getframerate() / 1000

    # get frames
    tmp_frames = readwav(song)
    
    # combine left and right channels if stereo
    if song.getnchannels() == 2:
        frames = tmp_frames[:, 0].copy() + tmp_frames[:, 1].copy()
    elif song.getnchannels() == 1:
        frames = tmp_frames
    else:
        raise IOError("Input audio must have either 1 or 2 channels")

    if duration == -1:
        frames = frames[start * song.getframerate():]
    else:
        frames = frames[start * song.getframerate():(start + duration) *
             song.getframerate()]
             
    print "Wav file has been read"
    
    hamming = N.hamming(wlen_samples)
    nwindows = int(2 * song.getnframes() / wlen_samples - 1)
    energies = N.empty(nwindows)
    for i in range(nwindows):
        tmp_segment = frames[i * wlen_samples / 2:
                             i * wlen_samples / 2 + wlen_samples]
        energies[i] = RMS_energy(tmp_segment * hamming)

    energies_list = [[x] for x in energies]
    
    print "Computed energies"
    
    S_matrix = 1 - scidist.squareform(
                    scidist.pdist(energies_list, 'euclidean'))
                    
    print "Computed similarities"

    # smooth the C matrix with a gaussian taper
    C_matrix = N.kron(N.eye(2), N.ones((k,k))) -\
               N.kron([[0, 1], [1, 0]], N.ones((k,k)))
    g = scipy.signal.gaussian(2*k, k)
    C_matrix = N.multiply(C_matrix, N.multiply.outer(g.T, g))
    
    print "Created checkerboard kernel"
    
    N_vec = N.zeros(N.shape(S_matrix)[0])
    for i in xrange(k, len(N_vec) - k):
        S_part = S_matrix[i - k:i + k, i - k:i + k]
        N_vec[i] = N.sum(N.multiply(S_part, C_matrix))
        
    print "Computed checkerboard response"

    peaks = naive_peaks(N_vec)
    out_peaks = []
    
    # ensure that the points we return are more exciting
    # after the change point than before the change point
    for p in peaks:
        frame = p[0]
        if frame > k:
            left_frames = frames[int((frame - k) * wlen_samples / 2):
                                 int(frame * wlen_samples / 2)]
            right_frames = frames[int(frame * wlen_samples / 2):
                                  int((frame + k) * wlen_samples / 2)]
            if RMS_energy(left_frames) <\
               RMS_energy(right_frames):
               out_peaks.append(p)

    out_peaks = [(x[0] * wlen_ms / 2000.0, x[1]) for x in out_peaks]
    for i, p in enumerate(out_peaks):
        if i == nchangepoints:
            break
        print "%d: %s\tscore:%.6f" % (i, s2m(p[0]), p[1])
    
    return [x[0] for x in out_peaks[:nchangepoints]]

def smooth(x,window_len=11,window='hanning'):
    """smooth the data using a window with requested size."""

    if x.ndim != 1:
        raise ValueError, "smooth only accepts 1-D arrays."

    if x.size < window_len:
        raise ValueError, "Input vector needs to be bigger than window size."


    if window_len<3:
        return x


    if not window in ['flat', 'hanning', 'hamming', 'bartlett', 'blackman']:
        raise ValueError, "Window is on of 'flat', 'hanning', 'hamming', 'bartlett', 'blackman'"


    s=N.r_[x[window_len-1:0:-1],x,x[-1:-window_len:-1]]

    if window == 'flat': #moving average
        w=N.ones(window_len,'d')
    else:
        w=eval('N.'+window+'(window_len)')

    y=N.convolve(w/w.sum(),s,mode='valid')
    return y


def naive_peaks(vec):
    """
    Smooth vector
    Find peaks
    Find local max from original, pre-smoothing
    Return (sorted, descending) peaks
    """
    a = smooth(vec, 33)
    peaks = N.r_[True, a[1:] > a[:-1]] & N.r_[a[:-1] > a[1:], True]

    p = N.array(N.where(peaks)[0])
    maxidx = N.zeros(N.shape(p))
    maxvals = N.zeros(N.shape(p))
    for i, pk in enumerate(p):
        maxidx[i] = N.argmax(vec[pk - 16:pk + 16]) + pk - 16
        maxvals[i] = N.max(vec[pk - 16:pk + 16])
    out = N.array([maxidx, maxvals]).T
    return out[(-out[:, 1]).argsort()]


def visualize_novelty(vec):
    plt.subplot(211)
    plt.plot(vec)
    plt.subplot(212)
    plt.plot(smooth(vec, 33))
    plt.show() 

if __name__ == '__main__':
    novelty(sys.argv[1], k=int(sys.argv[2]))