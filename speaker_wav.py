import sys
import simplejson as json
from radiotool import composer as C
import os

wav_fn = sys.argv[1]
transcript_fn = sys.argv[2]
speaker = sys.argv[3]

basename = os.path.basename(wav_fn)

transcript = json.load(open(transcript_fn, 'r'))["words"]

c = C.Composition(channels=1)
t = C.Track(wav_fn, speaker)
c.add_track(t)

score_loc = 0.0
start = None
end = None
for word in transcript:
	if "speaker" in word:
		if word["speaker"] == speaker:
			if start is None:
				start = word["start"]
			end = word["end"]
		else:
			if start is not None:
				seg = C.Segment(t, start, start, end - start)
				c.add_score_segment(seg)
				start = None
				end = None
if start is not None:
	seg = C.Segment(t, start, start, word["end"] - start)
 	c.add_score_segment(seg)

c.output_score(
    adjust_dynamics=False,
    min_length=t.total_frames(),
    filename="static/%s-%s-test" % (basename, speaker),
    channels=1,
    filetype='wav',
    samplerate=t.sr(),
    separate_tracks=False)
