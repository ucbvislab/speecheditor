import os
from subprocess import check_output
import sys
import simplejson as json

def analyze_speech(mp3_path, text_path, name):
    # text to transcript
    transcript_path = os.path.splitext(text_path)[0] + '.transcript'
    alignment_path = os.path.splitext(text_path)[0] + '.json'
    wav_path = os.path.splitext(mp3_path)[0] + '.wav'
    waveform_path = os.path.join(
        os.path.split(mp3_path)[0], 'wfData/{}.wav.json'.format(name))
    check_output(
        "python utilities/transcript_parser.py {} {}".format(
            text_path, transcript_path), shell=True)
    with open(transcript_path, 'r') as trf:
        if len(json.load(trf)) == 0:
            check_output(
                "python p2fa-vislab/text_to_transcript.py {} --output-file {}".format(
                    text_path, transcript_path), shell=True)

    # split multiple speakers
    # check_output(
    #     "python utilities/split-transcript.py {}".format(transcript_path),
    #     shell=True)

    # with open(transcript_path, 'r') as trf:
    #     transcript = json.load(trf)
    #     speakers = set()
    #     for line in transcript:
    #         speakers.add(line["speaker"])

    #     if len(speakers) < 2:
    #         # align everything at once

    #     for speaker in speakers:
    #         check_output(
    #             "python utilities/speaker_wav")

    # alignment
    check_output("lame --decode {}".format(mp3_path), shell=True)
    os.chdir('p2fa-vislab')
    check_output("python align.py ../{} ../{} ../{} --json --phonemes".format(
        wav_path, transcript_path, alignment_path), shell=True)

    # breath detection
    check_output("python detect_breaths.py ../{} ../{}".format(wav_path, alignment_path), shell=True)
    os.chdir('..')

    # wav2json
    check_output("wav2json -p 2 -s 10000 --channels mid -n -o {} {}".format(
        waveform_path, wav_path), shell=True)

if __name__ == '__main__':
    analyze_speech(sys.argv[1], sys.argv[2], sys.argv[3])
