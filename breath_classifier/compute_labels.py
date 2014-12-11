import sys
import os
import re

import numpy as N
from scipy.signal import lfilter

from radiotool import composer as C

global_wlen = 441. / 11025.

directory = 'processed_labels/'
try:
    directory = sys.argv[2]
except:
    pass

def get_labels(filename, song_length):
    f = open(filename, 'r')
    start_time = []
    end_time = []
    label = []
    for line in f:
        if not line.startswith("#"):
            if line.endswith("\n"):
                line = line[:-1]
            parts = re.compile('\s+').split(line)
            #parts = line.split(' ')
            start_time.append(float(parts[0]))
            end_time.append(float(parts[1]))
            if parts[2] == 'breath':
                label.append(1)
            elif parts[2] == 'pause':
                label.append(0)
    sample_times = N.arange(0, song_length, global_wlen)
    labels_by_time = N.zeros(N.shape(sample_times))
    for j, t in enumerate(sample_times):
        for i, st in enumerate(start_time):
            if t >= st and t < end_time[i] and label[i] == 1:
                labels_by_time[j] = 1
    return labels_by_time

fn = sys.argv[1]

name = fn.split('.wav')[0].split('/')[-1]

song = C.Song(fn, 'woop')
n_song_frames = song.duration
length = n_song_frames / float(song.samplerate)

labels = get_labels("labels/%s.lab" % name, length)

N.savetxt(directory + name + '.csv', labels, delimiter=',', fmt="%d")
