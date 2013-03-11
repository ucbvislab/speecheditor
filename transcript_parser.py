import sys
from collections import namedtuple
import re
import argparse
try:
    import simplejson as json
except:
    import json


DialogLine = namedtuple('DialogLine', ['speaker', 'line'])


def parse(transcript):
    """transcript is a string, formatted like a castingwords.org transcript"""

    lines = transcript.split('\n')

    script = []

    speaker_name = re.compile(r'^\s\s([^\s:]+):?')
    line_text = re.compile(r'^.{20}([^s].*)')
    special_token = re.compile(r'\[([^\[\]])\]')

    current_speaker = []
    current_line = []

    for i, line in enumerate(lines):
        match = speaker_name.match(line)
        if match:
            current_speaker.append(match.group(1))

        line_match = line_text.match(line)
        if line_match:
            current_line.append(line_match.group(1))

        if i + 1 == len(lines) or (
            len(line) == 0 and speaker_name.match(lines[i + 1])):
            # construct the DialogLine

            if len(current_speaker) > 0:
                line = " ".join(current_line)
                line = re.sub(r'\[[^\[\]]*\]', '', line)
                line = re.sub(r'\s+$', '', line)
                line = re.sub(r'$\s+', '', line)
                line = re.sub(r'\s--\s', '-- ', line)
                line = re.sub(r'\s-\s', '- ', line)
                dl = DialogLine(speaker=" ".join(current_speaker),
                                line=line)

                script.append(dl)

            # reset vars
            current_line = []
            current_speaker = []

    speakers = []
    for dl in script:
        if dl.speaker not in speakers:
            speakers.append(dl.speaker)

    return [{"speaker": dl.speaker, "line": dl.line} for dl in script], speakers


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Process args')
    parser.add_argument('input', help="Input text file from castingwords")
    parser.add_argument('output', help="output .transcript json file")
    parser.add_argument('-s', '--split',
        help="split output into one file per speaker")
    args = parser.parse_args()
    
    with open(args.input, 'r') as file:
        script, speakers = parse(file.read())
        json.dump(script, open(args.output, 'w'), indent=4)
        
        if args.split:
            print "Not supporting split yet... stay tuned!"
                
