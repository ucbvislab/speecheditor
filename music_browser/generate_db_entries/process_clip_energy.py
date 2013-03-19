# get energy for each clip
import sys

import numpy as N

from frontend import *
from frontend import Pipeline
import songs_db

def get_energy(filename):
    src = AudioSource(filename)
    pipe = Pipeline(src)
    frames = pipe.toarray()
    return N.sqrt(N.mean(frames ** 2))
    
if __name__ == '__main__':
    import csv
    e = get_energy(sys.argv[1])
    f = open('tal-music/clips/changepoints/energy.csv', 'a')
    c = csv.writer(f)
    name = sys.argv[1].split('/')[-1]
    name = '-'.join(name.split('-')[:2]) + '.mp3'
    song_id = songs_db.filename_resolver(name)
    if not song_id:
        song_id = sys.argv[1].split('/')[-1]
    out = [song_id, e]
    c.writerow(out)
    f.close()