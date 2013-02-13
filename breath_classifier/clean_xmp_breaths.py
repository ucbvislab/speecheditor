import sys
import re

with open(sys.argv[1]) as f:
    lines = f.readlines()

sample = re.compile(r'.*startTime>(\d+)f?.*')

current = 0.0
lab = "pause"

out_lines = []

for line in lines:
    m = sample.match(line)
    if m:
        samp = float(m.group(1)) / 11025.0
        out_lines.append("%.03f %.03f %s" %
            (current, samp, lab))
        current = samp
        if lab == 'pause':
            lab = 'breath'
        else:
            lab = 'pause'

print out_lines
            
with open(sys.argv[1], 'w') as f:
    for l in out_lines:
        f.write(l + '\n')

        