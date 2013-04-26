# generate first underlay for all of the songs in the corpus

import sys
import os

sys.path.append('/Users/rubin/underscore/code')

import assemble

songs_dir = sys.argv[1]

for root, dirs, files in os.walk(songs_dir):
    for f in files:
        fparts = f.split(".")
        if fparts[-1] == "wav":
            print f
            
            with open('points/' + f + '.txt', 'r') as file:
                first = float(file.readline())
                
                try:
                    args = {"song_cut": first, "speech_cut": 25,
                            "song_file": songs_dir + f,
                            "speech_title": 'sedaris',
                            "speech_file": 'speech/sedaris.wav',
                            "out_file": 'underlays/' +
                                '.'.join(f.split('.')[:-1]),
                            "count": 1,
                            "song_cut_limit": 0 }
                    assemble.assemble_track(args)
                except:
                    print "Unexpected error:", sys.exc_info()[0]
                    print "Couldn't generate output from " + f
                    
                