import sys
import os

import numpy as N
from scipy.signal import lfilter

from radiotool import composer as C
sys.path.append(os.path.join('/Users/srubin/code/'))
from frontend import *
from frontend import Pipeline

directory = 'processed_features/'
try:
    directory = sys.argv[2]
except:
    pass

def get_mfcc(filename):
    src = AudioSource(filename)
    pipe = Pipeline(src, MFCC(11025, 441, nhop=441, nmel=40, ndct=13,
                              fmin=133.3333))  
    return pipe.toarray()

def deltas(x, window_size=9):
    # define window shape
    h_len = int(window_size / 2)
    w = 2 * h_len + 1
    win = N.arange(h_len, -h_len, -1)
    
    # pad data by repeating first and last columns
    shape = N.shape(x)
    xx = N.zeros((shape[0] + 2 * h_len, shape[1]))
    xx[h_len:-h_len, :] = x
    xx[:h_len, :] = N.tile(x[0, :], (h_len, 1))
    xx[-h_len:, :] = N.tile(x[-1, :], (h_len, 1))

    #for r in xrange(h_len, N.shape(xx)[0] - h_len):
    #    for c in xrange(N.shape(xx)[1]):
    #        pass
    
    # apply the delta filter
    d = lfilter(win, 1, xx, zi=None, axis=0)
    
    # trim edges
    d = d[h_len:-h_len, :]
    return d

fn = sys.argv[1]

name = fn.split('.wav')[0].split('/')[-1]

cc = get_mfcc(fn)
# cepstral mean normalization
# cep_mean = N.mean(cc, axis=0)
# cc -= cep_mean

song = C.Song(fn, 'woop')
n_song_frames = song.total_frames()
length = n_song_frames / float(song.sr())
n_subframes = N.shape(cc)[0]
features = N.hstack((cc, deltas(cc, 5), deltas(deltas(cc, 5), 5)))

N.savetxt(directory + name + '.csv', features, delimiter=',', fmt="%.5f")
