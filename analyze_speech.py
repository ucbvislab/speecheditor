import os
import subprocess
import sys
import ujson as json

import click
from radiotool import composer as C


def speaker_wav(wav_fn, alignment_path, speaker):
    basename = ".".join(os.path.basename(wav_fn).split('.')[:-1])

    alignment = json.load(open(alignment_path, 'r'))["words"]

    c = C.Composition(channels=1)
    t = C.Track(wav_fn, speaker)
    c.add_track(t)

    score_loc = 0.0
    start = None
    end = None
    for word in alignment:
        if "speaker" in word:
            if word["speaker"] == speaker:
                if start is None:
                    start = word["start"]
                end = word["end"]
            else:
                if start is not None:
                    seg = C.Segment(t, start, start, end - start)
                    c.add_segment(seg)
                    start = None
                    end = None
    if start is not None:
        seg = C.Segment(t, start, start, word["end"] - start)
        c.add_segment(seg)

    out_fn = "static/speechtracks/%s-%s" % (basename, speaker)

    c.export(
        min_length=t.duration,
        filename=out_fn,
        channels=1,
        filetype='wav',
        samplerate=t.samplerate,
        separate_tracks=False)

    return out_fn + ".wav"


def analyze_speech(mp3_path, text_path, name, force=False):
    # text to transcript
    transcript_path = os.path.splitext(text_path)[0] + '.transcript'
    alignment_path = os.path.splitext(text_path)[0] + '.json'
    wav_path = os.path.splitext(mp3_path)[0] + '.wav'
    subprocess.call(
        "python utilities/transcript_parser.py {} {}".format(
            text_path, transcript_path), shell=True)
    with open(transcript_path, 'r') as trf:
        if len(json.load(trf)) == 0:
            speaker_name = raw_input("Enter the name of the speaker: ")
            subprocess.call(
                "python p2fa-vislab/text_to_transcript.py {} --output-file {} --speaker-name \"{}\"".format(
                    text_path, transcript_path, speaker_name), shell=True)

    # alignment
    if not os.path.isfile(alignment_path) or force:
        subprocess.call("lame --decode {}".format(mp3_path), shell=True)
        os.chdir('p2fa-vislab')
        subprocess.call("python align.py ../{} ../{} ../{} --json --phonemes".format(
            wav_path, transcript_path, alignment_path), shell=True)

        # breath detection
        subprocess.call("python detect_breaths.py ../{} ../{}".format(wav_path, alignment_path), shell=True)
        os.chdir('..')

    # wav2json
    speakers = set()
    with open(transcript_path, 'r') as trf:
        transcript = json.load(trf)
        for line in transcript:
            speakers.add(line["speaker"])

        for speaker in speakers:
            speaker_wav_path = speaker_wav(wav_path, alignment_path, speaker)
            speaker_waveform_path = os.path.join(
                os.path.split(mp3_path)[0], 'wfData/{}-{}.wav.json'.format(name, speaker))

            subprocess.call("wav2json -p 2 -s 10000 --channels mid -n -o \"{}\" \"{}\"".format(
                speaker_waveform_path, speaker_wav_path), shell=True)
            os.remove(speaker_wav_path)

@click.command()
@click.argument('name')
@click.option('--force/--no-force', default=False,
              help="Re-align the text/audio even if the alignment already exists")
def click_analyze_speech(name, force):
    mp3_path = "static/speechtracks/{}.mp3".format(name)
    text_path = "static/speechtracks/{}.txt".format(name)
    analyze_speech(mp3_path, text_path, name, force=force)


if __name__ == '__main__':
    click_analyze_speech()
