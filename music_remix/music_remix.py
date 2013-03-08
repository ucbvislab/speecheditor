import sys
import copy
import os
import subprocess
import simplejson as json
from decimal import *

from echonest.remix.audio import LocalAudioFile
import networkx as nx
from networkx.readwrite import json_graph
import numpy as N

import earworm
from radiotool import composer as C


from pyechonest import config
config.ECHO_NEST_API_KEY = "0KJK6BQUW0BV6XX3I"

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

        track = LocalAudioFile(self.filename, verbose=self.verbose)

        graph, dense_mats = earworm.do_work(track, graph_only=True,
            verbose=self.verbose, force=True, string_names=True,
            dense_result=True)

        tim = dense_mats["timbre"]
        pit = dense_mats["pitch"]

        cost_mat = N.exp(pit / N.std(pit) + tim / N.std(tim))

        edge_lens = [graph[e[0]][e[1]]["duration"]
                     for e in graph.edges_iter()]
        avg_duration = N.mean(edge_lens)

        N.savez(os.path.join(self.cache_path, npz_filename), 
            timbre=dense_mats["timbre"],
            pitch=dense_mats["pitch"],
            avg_duration=N.array([avg_duration]),
            cost=cost_mat,
            markers=N.array(dense_mats["markers"])
        )

        self._graph = graph
        try:
            path = os.path.join(self.cache_path, json_filename)
            print path

            data = dict(nodes=[[n, self._graph.node[n]]
                               for n in self._graph.nodes()],
                        edges=[[u, v, self._graph.edge[u][v]]
                               for u, v in self._graph.edges()])

            for e in data["edges"]:
                for k, v in e[2].iteritems():
                    e[2][k] = Decimal(str(v))

            with open(path, 'w') as file:
                json.dump(data, file, use_decimal=True)

            print "Reading json (initial generation)"
            self._graph = self.read_json_graph(path)
            print "Done reading json (initial generation)"
        except Exception, e:
            print e
            pass
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
