import sys
import copy
import os
import subprocess
import simplejson as json
from decimal import *

import networkx as nx
from networkx.readwrite import json_graph
import numpy as np

from radiotool import composer as C
from radiotool.algorithms import librosa_analysis


class MusicGraph(object):

    def __init__(self, filename, cache_path=None,
                 verbose=False):
        self.cache_path = cache_path
        self.filename = filename
        self.verbose = verbose
        self._graph = None

    @property
    def graph(self):
        if self._graph is not None:
            return self._graph

        gml_filename = os.path.splitext(
            os.path.basename(self.filename))[0] + '.gml'

        json_filename = os.path.splitext(
            os.path.basename(self.filename))[0] + '.json'

        npz_filename = os.path.splitext(
            os.path.basename(self.filename))[0] + '.npz'

        # retrieve cached copy?
        if self.cache_path is not None:
            try:
                path = os.path.join(self.cache_path, json_filename)
                print "Reading json"
                self._graph = self.read_json_graph(path)
                # self._graph = nx.read_gml(path, relabel=True)
                print "Done reading json"
                return self._graph
            except Exception, e:
                print e
                pass

        # new version
        track = C.Song(self.filename, cache_dir=self.cache_path)
        rt_tim = np.array(track.analysis["timbres"])
        rt_pit = np.array(track.analysis["chroma"])
        rt_dist = np.array(track.analysis["dense_dist"])

        rt_timbre_dist = librosa_analysis.structure(rt_tim.T)
        rt_chroma_dist = librosa_analysis.structure(rt_pit.T)

        rt_cost_mat = rt_chroma_dist + rt_timbre_dist

        rt_json_graph = {}
        rt_json_graph["nodes"] = []
        beats = np.array([round(beat, 6) for beat in track.analysis["beats"]])
        str_beats = [str(beat) for beat in beats]

        for beat in beats:
            rt_json_graph["nodes"].append([str(beat), {}])

        rt_json_graph["edges"] = []
        for b_i, (b1, b2) in enumerate(zip(beats[:-1], beats[1:])):
            rt_json_graph["edges"].append([
                str_beats[b_i],
                str_beats[b_i + 1],
                {
                    "distance": 0,
                    "target": b_i + 1,
                    "source": b_i,
                    "timbredist": 0,
                    "duration": b2 - b1,
                    "pitchdist": 0
                }
            ])


        for b_i, row in enumerate(rt_cost_mat):
            good_transitions = np.where(row < .1)[0] - b_i + 1
            for gt_i in good_transitions:
                try:
                    if np.abs(gt_i) > 3:
                        rt_json_graph["edges"].append([
                            str_beats[b_i],
                            str_beats[b_i + gt_i],
                            {
                                "distance": round(row[gt_i - 1 + b_i], 5),
                                "target": b_i + gt_i,
                                "source": b_i,
                                "timbredist": round(rt_timbre_dist[b_i, b_i + gt_i - 1], 5),
                                "pitchdist": round(rt_chroma_dist[b_i, b_i + gt_i - 1], 5),
                                "duration": round(beats[b_i + 1] - beats[b_i], 5)
                            }
                        ])
                except:
                    pass

        try:
            path = os.path.join(self.cache_path, json_filename)
            print path

            with open(path, 'w') as f:
                json.dump(rt_json_graph, f, use_decimal=True)

            print "Reading json (initial generation)"
            self._graph = self.read_json_graph(path)
            print "Done reading json (initial generation)"
        except Exception, e:
            print e
            pass

        np.savez(os.path.join(self.cache_path, npz_filename),
            timbre=rt_timbre_dist,
            pitch=rt_chroma_dist,
            avg_duration=np.array([np.mean(beats[1:] - beats[:-1])]),
            cost=rt_cost_mat,
            markers=np.array(beats)
        )

        return self._graph

    def json_graph(self):
        G = self.graph
        return dict(nodes=[[n, G.node[n]] for n in G.nodes()],
                   edges=[[u, v, G.edge[u][v]] for u, v in G.edges()])

    @staticmethod
    def read_json_graph(filename):
        with open(filename, 'r') as file:
            g = json.load(file, use_decimal=True)
            graph = nx.DiGraph()
            graph.add_nodes_from(g["nodes"])
            graph.add_edges_from(g["edges"])
            return graph


    def find_loop(self, start_time, end_time):
        graph = self.graph

        # create a subgraph with just the nodes in the time frame
        span_nodes = []
        for n in graph.nodes(data=True):
            if float(n[0]) > start_time and float(n[0]) < end_time:
                span_nodes.append(n[0])
        subgraph = graph.subgraph(span_nodes)
        cycles = nx.simple_cycles(subgraph)
        if len(cycles) == 0:
            print "There are no loops in this time span. Alas!"
            return
        longest_cycle = max(cycles, key=lambda x: len(x))
        print "Longest cycle:", longest_cycle

        # compose the audio
        wav_fn = ".".join(self.filename.split('.')[:-1]) + '.wav'
        
        try:
           with open(wav_fn) as f: pass
        except IOError as e:
           # convert to wav
           subprocess.call(
               'lame --decode "%s"' % self.filename, shell=True)

        track = C.Track(wav_fn, "song to remix")
        c = C.Composition(tracks=[track])

        score_loc = 0.0

        for i, node in enumerate(longest_cycle[:-1]):
            for edge in subgraph.edges_iter(nbunch=[node], data=True):
                if edge[1] == longest_cycle[i + 1]:
                    segment = C.Segment(track, score_loc,
                                        node, edge[2]["duration"])
                    c.add_score_segment(segment)
                    score_loc += edge[2]["duration"]
                    break

        c.output_score(adjust_dynamics=False,
            filename="boom",
            channels=2,
            filetype='wav',
            separate_tracks=False)


if __name__ == '__main__':
    mg = MusicGraph(sys.argv[1], cache_path='cache/')
    mg.find_loop(20, 40)
