import sys
import simplejson as json
from collections import defaultdict

with open(sys.argv[1]) as f:
    transcript = json.load(f)
    
    speaker_lines = defaultdict(list)
    
    for line in transcript:
        speaker_lines[line["speaker"]].append(line)
    
for k, v in speaker_lines.iteritems():
    ext = sys.argv[1].split('.')[-1]
    fn = ".".join(sys.argv[1].split('.')[:-1])
    with open(fn + '-' + k + '.' + ext, "w") as f:
        json.dump(v, f)

