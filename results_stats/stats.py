# Collect statistics from input songs/transcripts

import sys
import simplejson as json
from collections import defaultdict
import datetime
import duplicate_lines

from radiotool.composer import Speech

def collect_stats(name):
    track = Speech("static/%s44.wav" % name, 'speech track')
    transcript = json.load(open("static/%s-breaths.json" % name, 'r'))

    stats = {}

    seconds = track.total_frames() / float(track.sr())
    m, s = divmod(seconds, 60)

    stats["length"] = "%d:%02d" % (m, s)

    words = transcript["words"]

    count = defaultdict(int)

    last_was_dupe = False

    for i, word in enumerate(words):
        if word["alignedWord"] == 'sp':
            count["pause"] += 1
        elif word["alignedWord"] == 'gp':
            count["roomtone_pause"] += 1
        elif word["alignedWord"] == '{BR}':
            count["breath"] += 1
        else:
            count["word"] += 1

        if word["alignedWord"] in ['UH', 'UM', 'AH', 'EH', 'UHH', 'UMM']:
            count["unnecessary"] += 1

        if i < len(words) - 1:
            if word["alignedWord"] == words[i + 1]["alignedWord"]:
                last_was_dupe = True

            elif last_was_dupe:
                last_was_dupe = False
                count["duplicate_words"] += 1


    stats["words"] = count["word"]
    stats["pauses"] = count["pause"]
    stats["roomtone_pause"] = count["roomtone_pause"]
    stats["breaths"] = count["breath"]
    stats["unnecessary"] = count["unnecessary"]
    stats["duplicate_words"] = count ["duplicate_words"]


    # similar sentences
    dupes = duplicate_lines.get_dupes(words)
    for d in dupes:
        if len(d) > 1:
            count["dupe_sentences"] += 1


    stats["dupe_sentences"] = count["dupe_sentences"]
    stats["dupe_sentence_size"] = 0

    return stats


if __name__ == '__main__':
    stats = []
    if len(sys.argv) > 1:
        stats.append(collect_stats(sys.argv[1]))
        all_names = [sys.argv[1]]
    else:
        all_names = ["bullw-full", "photoshop", "bluesmobile",
                     "bluesmobile-interview", "teleclip", "obama", "scorerickard"]
        for name in all_names:
            stats.append(collect_stats(name))


    order = ["length", "words", "pauses", "breaths",
             "unnecessary", "duplicate_words", "dupe_sentences"]

    for i, stat in enumerate(stats):
        print
        print all_names[i]
        print "%s & %d & %d & %d & %d & %d & %d \\\\" % tuple([stat[x] for x in order])

