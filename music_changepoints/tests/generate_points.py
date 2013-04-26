# generate points for all of the songs in the corpus

import subprocess
import sys
import os

songs_dir = sys.argv[1]

for root, dirs, files in os.walk(songs_dir):
    for f in files:
        fparts = f.split(".")
        if fparts[-1] == "wav":
            print f
            
            cpp = subprocess.check_output(
                ['../novelty', songs_dir + f, '64', 'chroma', 'euc', '5', '.5']).split('\n')
            
            with open('points/' + f + '.txt', 'w') as file:
                for pt in cpp:
                    if pt != '':
                        file.write(pt + '\n')
                    
                    
                