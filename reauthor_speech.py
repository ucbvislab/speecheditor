import sys
import os
import subprocess
try:
    import simplejson as json
except:
    import json
import sys
import numpy as N

from radiotool.composer import Composition, Speech, Segment, RawTrack
from radiotool.utils import equal_power


class EditGroup:
    def __init__(self, start, end, edit_index, speaker=None):
        self.start = start
        self.end = end
        self.edit_index = edit_index
        self.speaker = speaker

class Pause(EditGroup):
    def __init__(self, start, end, new_length, edit_index, generic=False):
        EditGroup.__init__(self, start, end, edit_index)
        self.new_length = new_length
        self.generic = generic

def rebuild_audio(speech, alignment, edits, **kwargs):
    cut_to_zc = kwargs.pop('cut_to_zc', True)
    out_file = kwargs.pop('out_file', 'out')
    samplerate = kwargs.pop('samplerate', 16000)
    crossfades = kwargs.pop('crossfades', True)
    tracks_and_segments = kwargs.pop('tracks_and_segments', False)
    score_start = kwargs.pop('score_start', 0.0)
    render_from_all_tracks = kwargs.pop('render_from_all_tracks', False)
    fade_duration = 0.005

    cuts = []
    for i, word in enumerate(edits):
        start = round(word["start"], 5)
        end = round(word["end"], 5)
        
        if word["alignedWord"] == "sp" and "modifiedPause" in word:
            pause_len = round(word["pauseLength"], 5)
            cuts.append(Pause(start, end, pause_len, i))
        elif word["alignedWord"] == "gp":
            # handle generic pauses (room tone)
            print word
            pause_len = round(word["pauseLength"], 5)
            cuts.append(Pause(start, end, pause_len, i, generic=True))
        else:
            speaker = None
            if "speaker" in word:
                speaker = word["speaker"]
            cuts.append(EditGroup(start, end, i, speaker=speaker))

    for i in range(len(alignment)):
        alignment[i]["start"] = round(alignment[i]["start"], 5)
        alignment[i]["end"] = round(alignment[i]["end"], 5)
        

    # break the cuts into cut groups
    # because we don't want to leave silence between adjacent words
    edit_groups = []
    new_group = True
    new_pause = False
    first = True
    align_idx = 0

    # bail if there's no speech
    if len(cuts) == 0:
        if tracks_and_segments:
            out = {}
            out["tracks"] = []
            out["segments"] = []
            out["samplerate"] = 44100
            out["channels"] = 1
            out["timing"] = []
            return out
    
    
    speakers = set()

    if isinstance(cuts[0], Pause):
        new_pause = True
        new_group = False
    
    last_speaker = None
    for cut_idx, cut in enumerate(cuts):
        if not first:
            align_idx += 1
            if last_speaker is None:
                last_speaker = cut.speaker
                edit_groups[-1].speaker = last_speaker
                if last_speaker is not None:
                    speakers.add(last_speaker)
            if cut.speaker is None:
                cut.speaker = last_speaker
            if isinstance(cut, Pause):
                new_pause = True
            elif (alignment[align_idx]["start"] != cut.start or
                  (last_speaker is not None and cut.speaker != last_speaker)):
                new_group = True 
        else:
            first = False
        if new_group:
            align_idx = 0
            edit_groups.append(cut)
            while alignment[align_idx]["start"] < cut.start:
                align_idx += 1
            new_group = False
            last_speaker = cut.speaker
            if last_speaker is not None:
                speakers.add(last_speaker)

        if new_pause:
            edit_groups.append(cut)
            new_pause = False
            new_group = True
    if last_speaker is not None:
        speakers.add(last_speaker)

    # correct trailing pause
    countdown = -2
    while edit_groups[-1].speaker is None:
        edit_groups[-1].speaker = edit_groups[countdown].speaker
        countdown -= 1

    # build the segments that correspond to the uncut segments of the speech
    segments = []
    composition_loc = score_start
    tracks = []
    
    start_times = []
    
    c = Composition(channels=1)

    speeches = {}

    # setup for interview footage with multiple speakers
    speeches["__base"] = Speech(speech, "base speech")
    c.add_track(speeches["__base"])

    if len(speakers) == 1:
        speeches[speakers.pop()] = speeches["__base"]
    else:
        base_speech_fn = os.path.splitext(speech)[0]
        for speaker in speakers:
            if render_from_all_tracks:
                speeches[speaker] = Speech("%s-%s.wav" % (base_speech_fn, speaker), speaker)
                c.add_track(speeches[speaker])
            else:
                speeches[speaker] = speeches["__base"]

    # new reauthoring loop
    for i, eg in enumerate(edit_groups):

        if isinstance(eg, Pause):
            s = speeches["__base"]
            pause = eg
            start = pause.start
            end = pause.end
            pause_len = pause.new_length

            # Done in the create_roomtone_pause2 method

            # if cut_to_zc:
            #     try:
            #         start = s.zero_crossing_after(start)
            #     except:
            #         pass
            #     try:
            #         end = s.zero_crossing_before(end)
            #     except:
            #         pass

            start_times.append(composition_loc)

            seg = Segment(s, composition_loc, start, end - start)
            track, cf_seg = create_roomtone_pause2(seg, pause_len, cut_to_zc)

            if cf_seg.duration < 0:
                start_times.append(composition_loc)
                continue

            c.add_track(track)
            c.add_segment(cf_seg)
            
            segments.append(cf_seg)
            # composition_loc += pause_len

            print "Added roomtone, length", cf_seg.duration / float(track.samplerate)

            composition_loc += cf_seg.duration / float(track.samplerate)
        else:
            if eg.speaker is None:
                print alignment[eg.edit_index]
                print eg.start, eg.end, eg.edit_index, eg.speaker
                raise AttributeError("Edit group has no speaker")
            s = speeches[eg.speaker]
            start = eg.start
            if i + 1 < len(edit_groups):
                end = cuts[edit_groups[i + 1].edit_index - 1].end
            else:
                end = cuts[-1].end

            if cut_to_zc:
                try:
                    start = s.zero_crossing_before(start)
                except:
                    pass
                try:
                    end = s.zero_crossing_after(end)
                except:
                    pass

            if start >= end:
                start_times.append(composition_loc)
                continue

            seg = Segment(s, composition_loc, start, end - start)
            print eg.speaker, "comp loc", composition_loc, "start", start, "end", end
            print "\t", s.filename
            c.add_segment(seg)
            start_times.append(composition_loc)
            segments.append(seg)

            composition_loc += end - start
    
    if crossfades:
        print "### Adding %d crossfades" % (len(segments) - 1)
        for i in range(len(segments) - 1):
            if segments[i].comp_location + segments[i].duration ==\
                segments[i + 1].comp_location:
                c.cross_fade(segments[i], segments[i + 1], .005)
    
    out = {}
    
    if not tracks_and_segments:
        c.export(
            adjust_dynamics=False,
            filename=out_file,
            channels=1,
            filetype='wav',
            samplerate=samplerate,
            separate_tracks=False)
    else:
        out["tracks"] = c.tracks
        out["segments"] = c.segments
        out["samplerate"] = samplerate
        out["channels"] = 1
    
        
    # return the start time of each word
    eg_idx = 0
    elapsed = 0.0
    timings = []
    for i, cut in enumerate(cuts):
        if eg_idx < len(edit_groups):
            if edit_groups[eg_idx].edit_index == cut.edit_index:
                elapsed = start_times[i]
        timings.append(round(elapsed, 5))
        if isinstance(cut, Pause):
            elapsed += cut.new_length
        else:
            elapsed += cut.end - cut.start
    out["timing"] = timings
    return out
    # return [(e.edit_index, start_times[i]) for i, e in enumerate(edit_groups)]


def create_roomtone_pause(segment, final_duration):
    final_dur_in_frames = int(final_duration * segment.track.samplerate)
    out = N.empty(final_dur_in_frames)
    
    breath_dur = segment.duration
    half_bd = int(breath_dur / 2)
    nbreaths = N.ceil(final_dur_in_frames / segment.duration) + 2
    
    # tile the breaths
    frames = segment.get_frames(channels=1)
    breaths =  N.tile(frames, [nbreaths])
    
    out = breaths[:final_dur_in_frames] +\
        breaths[half_bd:final_dur_in_frames + half_bd]
    

    sr = segment.track.samplerate
    track = RawTrack(out / 2, name="raw", samplerate=sr)

    raw_seg = Segment(track, segment.comp_location / float(sr),
                      0.0, final_duration)

    return track, raw_seg

def create_roomtone_pause2(segment, final_duration, cut_to_zc):
    final_dur_in_frames = int(final_duration * segment.track.samplerate)
    out = N.empty(final_dur_in_frames)
    
    breath_dur = segment.duration
    half_bd = int(breath_dur / 2)
    nbreaths = N.ceil(final_dur_in_frames / segment.duration) + 2
    
    # tile the breaths
    frames = segment.get_frames(channels=1)
    
    offset = 0
    if len(frames) % 2 == 1:
        offset = 1
    
    firsthalf = frames[:half_bd]
    secondhalf = frames[half_bd + offset:]
    cf = equal_power(secondhalf, firsthalf)
    
    breaths =  N.tile(cf, [nbreaths * 2])
    
    out = breaths[:final_dur_in_frames]

    sr = segment.track.samplerate
    track = RawTrack(out, name="raw", samplerate=sr)

    raw_seg = Segment(track, segment.comp_location / float(sr),
                      0.0, final_duration)

    if cut_to_zc:
        start = track.zero_crossing_after(0.0)
        end = track.zero_crossing_before(final_duration)

        raw_seg.start = int(start * sr)
        raw_seg.duration = int(end * sr - start * sr)

    return track, raw_seg


# def render_pauses_as_one_track(speech_file, alignment):
#     comp = Composition(channels=1)
#     speech = Speech(speech_file, "p")
#     comp.add_track(speech)
#     comp_loc = 0.0
#     fname = os.path.basename(speech_file)
#     # subprocess.call('rm tmp/pauses/*.wav', shell=True)
#     for x in alignment:
#         if x["alignedWord"] == "sp":
#             start = x["start"]
#             end = x["end"]
#             seg = Segment(speech, comp_loc, start, end - start)
#             comp.add_segment(seg)
#             comp_loc += (end - start)
#     comp.export(
#         adjust_dynamics=False,
#         filename="tmp/pauses-%s" % fname.split('.')[0],
#         channels=1,
#         filetype='wav',
#         samplerate=speech.samplerate,
#         separate_tracks=False)

# def render_breaths_and_pauses(audio_file, alignment):
#     comp = Composition(channels=1)
#     comp_loc = 0
#     pause_idx = 0
#     breath_idx = 0
#     for x in alignment:
#         if x["alignedWord"] == "sp":
#             audio = Speech(audio_file, "pause%02d" % pause_idx)
#             pause_idx += 1
#             comp.add_track(audio)
#             start = x["start"]
#             end = x["end"]
#             seg = Segment(audio, comp_loc, start, end - start)
#             comp.add_segment(seg)
#             comp_loc += end - start
#         elif x["alignedWord"] == "{BR}":
#             audio = Speech(audio_file, "breath%02d" % breath_idx)
#             breath_idx += 1
#             comp.add_track(audio)
#             start = x["start"]
#             end = x["end"]
#             seg = Segment(audio, comp_loc, start, end - start)
#             comp.add_segment(seg)
#             comp_loc += end - start
#     comp.export(
#         adjust_dynamics=False,
#         filename="tmp/pb",
#         channels=1,
#         filetype='wav',
#         samplerate=audio.samplerate,
#         separate_tracks=True)


# def find_breaths(speech, alignment):
#     breaths = []

#     breath_threshold = .5
    
#     import os
#     import glob
#     for wav_file in glob.glob('tmp/*.wav'):
#         try:
#             if os.path.isfile(wav_file):
#                 os.unlink(wav_file)
#         except Exception, e:
#             print e

#     for i, word in enumerate(alignment[:-1]):
#         if word["alignedWord"] == "sp":
#             breaths.append(word)
#         # if word["alignedWord"] == "sp" and\
#         #     word["end"] - word["start"] > .5:
#         #     breaths.append(word)
#         # if word["word"].endswith(".") and\
#         #     alignment[i + 1]["alignedWord"] == "sp":
#         #     breaths.append(alignment[i + 1])

#     for i, br in enumerate(breaths):
#         s = Speech(speech, str(i))
#         c = Composition(tracks=[s], channels=1)
#         c.add_segment(
#             Segment(s, 0.0, br["start"], br["end"] - br["start"])
#         )
#         c.export(
#             adjust_dynamics=False,
#             filename="tmp/%d" % i,
#             channels=1,
#             samplerate=16000
#         )
        
#     return breaths

if __name__ == '__main__':
    # speech_file = sys.argv[1]
    # alignment = sys.argv[2]
    # edits = sys.argv[3]
    # 
    # af = open(alignment, "r").read()
    # ef = open(edits, "r").read()
    # 
    # # json that represents the alignment of words to speech
    # alignment = json.loads(af)["words"]
    # 
    # # json that represents the words to delete
    # edits = json.loads(ef)["words"]
    # 
    # rebuild_audio(speech_file, alignment, edits, 
    #               cut_to_zc=True, out_file="out-zc")
    # rebuild_audio(speech_file, alignment, edits,
    #               cut_to_zc=False, out_file="out-nzc")
    
    # speech_file = sys.argv[1]
    # alignment = sys.argv[2]
    # af = open(alignment, "r").read()
    # alignment = json.loads(af)["words"]
    # 
    # find_breaths(speech_file, alignment)
    
    if sys.argv[1] == "write_breaths":
        speech_file = sys.argv[2]
        alignment = sys.argv[3]
        af = open(alignment, "r").read()
        alignment = json.loads(af)["words"]
        render_breaths_and_pauses(speech_file, alignment)
    elif sys.argv[1] == "pauses_sep":
        speech_file = sys.argv[2]
        alignment = sys.argv[3]
        af = open(alignment, "r").read()
        alignment = json.loads(af)["words"]
        render_pauses(speech_file, alignment)
    elif sys.argv[1] == "pauses":
        speech_file = sys.argv[2]
        alignment = sys.argv[3]
        af = open(alignment, "r").read()
        alignment = json.loads(af)["words"]
        render_pauses_as_one_track(speech_file, alignment)