# extract MFCC features for moodswings-esque feature extraction

import sys
import glob

import numpy as N

from frontend import *
from frontend import Pipeline


def process_clip_mfccs(length, filename):
    src = AudioSource(filename)
    if length == "short":
        pipe = Pipeline(src, Resample(ratio=0.5),  # from 44.1 to 22.05 kHz 
                        MFCC(
                            22050,
                            512,
                            nhop=256,
                            nmel=40,
                            fmin=133.33,
                            fmax=6855.6,
                            ndct=20
                            ))
    elif length == "long":
        nframes = len(Pipeline(src).toarray())
        pipe = Pipeline(src, MFCC(
            22050,
            nframes,
            nmel=40,
            ndct=13
        ))
    elif length == "long_chunks":
        pipe = Pipeline(src, MFCC(
            22050,
            15 * 22050,
            nhop=15 * 22050,
            nmel=40,
            ndct=13
        ))
    else:
        return []
    return pipe.toarray()


if __name__ == '__main__':
    for file in glob.glob("changepoints/*.wav"):
        print file
        mfccs = process_clip_mfccs(sys.argv[1], file)
    
        # mfccs = process_clip_mfccs(sys.argv[1], sys.argv[2])
        if sys.argv[1] == "long":
            import csv
            f = open('changepoints/mfccs_long.csv', 'a')
            c = csv.writer(f)
            out = [file.split('/')[-1]]
            # out = [sys.argv[2].split('/')[-1]]
            out.extend(mfccs[0])
            c.writerow(out)
            f.close()
        if sys.argv[1] == "long_chunks":
            import pickle
            f = open('other-music/jazz.mfccs', 'w')
            pickle.dump(mfccs, f)
            import pdb; pdb.set_trace()
        