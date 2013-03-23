"""
Get the arpabet pronunciation of a set of words, courtesy
of the CMU Sphinx pronunciation dictionary (and their 
tools to determine the pronunciation of unknown words).

Usage: create a pronounce object, add words to pronounce object
       run .p()
       
Command line: python pronunciation.py list of words to pronounce

Copyright 2013 - Steven Rubin - srubin@cs.berkeley.edu
MIT License
"""

import requests
import sys
import re
import string

class Pronounce(object):
    url = "http://www.speech.cs.cmu.edu/cgi-bin/tools/lmtool/run"
    dict_re = re.compile(r"\d+\.dic")
    other_pr = re.compile(r"(.*)\(\d+\)$")
    vowel_re = re.compile(r"AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW")

    def __init__(self, words=None):
        if words:
            self.words = words
        else:
            self.words = []

    def add(self, word):
        self.words.append(word)

    def p(self, add_fake_stress=False):
        w_upper = [unicode(w).upper() for w in self.words]
        
        punc_map = dict((ord(c), None) for c in string.punctuation)
        w_nopunc = [s.translate(punc_map) for s in w_upper]

        file = {'corpus': ('words.txt', " ".join(w_nopunc))}

        res = requests.post(Pronounce.url,
                            data={"formtype": "simple"},
                            files=file, allow_redirects=True)
        base_url = res.url
        text = res.text
        dict_path = Pronounce.dict_re.search(text).group(0)
        res = requests.get(base_url + dict_path)
        
        # generate output dict
        pronunciations = {}
        for line in res.text.split('\n'):
            if len(line) > 0:
                pr = line.split('\t')
                match = Pronounce.other_pr.match(pr[0])
                if match:
                    pr[0] = match.group(1)
                idx = w_nopunc.index(pr[0])
                orig = self.words[idx]
                upword = w_upper[idx]
                
                if add_fake_stress:
                    pr[1] = re.sub(Pronounce.vowel_re, r"\g<0>0", pr[1])
                
                if orig in pronunciations:
                    pronunciations[orig].append(pr[1])
                else:
                    pronunciations[orig] = [upword, pr[1]]

        return pronunciations

if __name__ == '__main__':
    pr = Pronounce(sys.argv[1:])
    print pr.p()
