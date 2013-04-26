# a simple test to see if the output of the python and c++ matches

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
                ['../novelty', songs_dir + f, '64']).split('\n')
            py = subprocess.check_output(
                ['python', '../novelty_simple.py', songs_dir + f, '64'])\
                .split('\n')
            
            for i in range(max(len(cpp), len(py))):
                if i < len(cpp) and i < len(py):
                    if cpp[i] != py[i]:
                        print "C++ [%d]:" % i, cpp[i]
                        print "py  [%d]:" % i, py[i]
                elif i >= len(cpp):
                    print "C++ EOF"
                    print "py  [%d]:" % i, py[i]
                elif i >= len(py):
                    print "C++ [%d]:" % i, cpp[i]
                    print "py  EOF"
                    
                