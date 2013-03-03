import sys
import itertools

import numpy as N
import networkx as nx

from pathfinder import PathFinder
from novelty_simple import novelty
from radiotool.composer import Composition, Track, Segment


def changepoint_path(wav_fn, graph, length):
    """wave filename and graph from that wav, length in seconds"""
    # generate changepoints
    changepoints = novelty(wav_fn, k=64, nchangepoints=4)

    edge_lens = [graph[e[0]][e[1]]["duration"]
                 for e in graph.edges_iter()]
    avg_duration = N.mean(edge_lens)

    node_count = int(float(length) / avg_duration)

    nodes = sorted(graph.nodes(), key=float)

    closest_nodes = []
    node_to_cp = {}
    for cp in changepoints:
        closest_nodes.append(
            N.argmin([N.abs(float(node) - float(cp)) for node in nodes]))
        node_to_cp[str(closest_nodes[-1])] = cp


    out = []

    for pair in itertools.permutations(closest_nodes, r=2):
        print "Finding path for pair", pair, "of length", node_count
        
        avoid_nodes = [cn for cn in closest_nodes if cn not in pair]
        
        try:
            shortest_path = nx.astar_path_length(graph,
                nodes[pair[0]], nodes[pair[1]])
            print "# shortest path:", shortest_path
            if  shortest_path <= node_count:
        
                pf = PathFinder(graph=graph, start=pair[0],
                                end=pair[1], length=node_count)
                res, cost = pf.find(avoid=avoid_nodes)
                if res is not None:
                    out.append(res)
                    break
        except:
            pass

    print "Cost:", cost
    return out


if __name__ == '__main__':
    wav_fn = sys.argv[1]
    graph = nx.read_gml(sys.argv[2], relabel=True)
    out = changepoint_path(wav_fn, graph, sys.argv[3])
    print out
    
    if len(out) > 0:
        best = out[0]

        # render a few of them

        # handle music authored per beat
        starts = map(float, best)
        durs = [graph[best[i]][best[i + 1]]["duration"]
                for i in range(len(best) - 1)]

        # for post-padding
        durs.append(5.0)

        dists = [graph[best[i]][best[i + 1]]["distance"]
                 for i in range(len(best) - 1)]

        dists.append(0)

        score_start = 5.0
        track = Track(wav_fn, wav_fn)
        c = Composition(channels=2)
        c.add_track(track)
        c.add_score_segment(
            Segment(track, 0.0, starts[0] - 5.0, 5.0))
        current_loc = float(score_start)

        seg_start = starts[0]
        seg_start_loc = current_loc
        
        cf_durations = []
        
        segments = []

        for i, start in enumerate(starts):
            if i == 0 or dists[i - 1] == 0:
                dur = durs[i]                
                current_loc += dur
            else:
                seg = Segment(track, seg_start_loc,
                    seg_start, current_loc - seg_start_loc)
                c.add_score_segment(seg)
                segments.append(seg)
                
                print "segment added at", seg_start_loc, "start", seg_start, "dur", current_loc - seg_start_loc
                
                track = Track(wav_fn, wav_fn)
                c.add_track(track)
                dur = durs[i]
                cf_durations.append(dur)
                
                seg_start_loc = current_loc
                seg_start = start
                                
                current_loc += dur
        
        last_seg = Segment(track, seg_start_loc, seg_start,
            current_loc - seg_start_loc)
        c.add_score_segment(last_seg)
        segments.append(last_seg)
        
        # handle the case where there's a jump before the final frame
        if len(cf_durations) > 0:
            if (cf_durations[-1] == 5.0):
                if len(cf_durations) > 1:
                    cf_durations[-1] = cf_durations[-2]
                else:
                    cf_durations[-1] = .5

        print "cf_durations", cf_durations
        print "segments", segments

        for i, seg in enumerate(segments[:-1]):
            c.cross_fade(seg, segments[i + 1], cf_durations[i])

        c.output_score(
            adjust_dynamics=False,
            filename="test",
            channels=2,
            filetype='wav',
            separate_tracks=False)