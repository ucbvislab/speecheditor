# generate the XMP markers that can be added to a WAV file
# and then viewed in Audition. 

# For example: 
#./novelty path_to_song.wav 16 rms euc 48 .05 |
# python tests/xmp_markers.py | pbcopy

# and then use something like http://bwfmetaedit.sourceforge.net/ to
# actually add them to the WAV file.

import sys

template = '<rdf:li rdf:parseType="Resource"><xmpDM:startTime>%df44100</xmpDM:startTime><xmpDM:name>Marker %d</xmpDM:name></rdf:li>'

template2 = '<rdf:li rdf:parseType="Resource"><xmpDM:startTime>%df44100</xmpDM:startTime><xmpDM:duration>%df44100</xmpDM:duration><xmpDM:name>Marker %d</xmpDM:name></rdf:li>'

points = sys.stdin.read().split('\n')[:-1]

out = ""
for i, p in enumerate(points):
    pts = p.split(' ')
    if len(pts) == 1:
        out += template % (int(float(p) * 44100), i)
    elif len(pts) == 2:
        t1 = int(float(pts[0]) * 44100)
        t2 = int(float(pts[1]) * 44100)
        dur = t2 - t1
        out += template2 % (t1, dur, i)

print out