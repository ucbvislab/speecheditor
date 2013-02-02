# time stretch test (radiotool)

from radiotool.composer import Speech, TimeStretchSegment, Composition

track = Speech("static/scorerickard_first.wav", "speech")

comp = Composition(tracks=[track], channels=1)

seg = TimeStretchSegment(track, 0.0, 0.0, 10.0, 7.5)

comp.add_score_segment(seg)

comp.output_score(
    adjust_dynamics=False,
    filename="test_timestretch",
    channels=1,
    samplerate=16000)
