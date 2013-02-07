import sys

import Levenshtein
import networkx as nx

def get_dupes(words):
    """
    input: words json
    output: array of arrays of arrays (jk, it has the sentences, too) 
        (duplicate lines -> start/stop word indices of each sentence)
    """
    sentence_start = 0
    tmp_sentence = ""
    sentences = []
    sentence_idx = []
    for i, word in enumerate(words):
        if any(word["word"].endswith(x) for x in ['.', '?', '!', '"', ':']):
            tmp_sentence += word["word"]
            sentences.append(tmp_sentence)
            tmp_sentence = ''
            sentence_idx.append((sentence_start, i))
            sentence_start = i + 1
        elif word["alignedWord"] == "sp":
            if i == sentence_start:
                sentence_start += 1
            continue
        else:
            tmp_sentence += word["word"] + ' '

    # create a graph to track similar sentences
    sim = nx.Graph()

    for i, s in enumerate(sentences):
        sim.add_node((i, s, sentence_idx[i]))

    for i, s in enumerate(sentences):
        for j, t in enumerate(sentences):
            dist = Levenshtein.distance(s, t)
            if i != j and dist < max(len(s), len(t)) / 2.0:
                sim.add_edge((i, s, sentence_idx[i]), (j, t, sentence_idx[j]))

    out = []
    ccs = nx.connected_components(sim)
    for i in range(len(ccs)):
        ccs[i] = sorted(ccs[i], key=lambda x: x[0])
    ccs = sorted(ccs, key=lambda x: x[0][0])
    for cc in ccs:
        out.append([[elt[2], elt[1]] for elt in cc])
    return out
    

if __name__ == '__main__':
    try:
        import simplejson as json
    except:
        import json
    with open(sys.argv[1], 'r') as f:
        txt = json.load(f)["words"]
    print get_dupes(txt)