import sys
import copy
import os

# import echonest.remix as remix
from echonest.remix.audio import LocalAudioFile
import networkx as nx

import earworm

from radiotool import composer as C


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

        # retrieve cached copy?
        if self.cache_path is not None:
            try:
                path = os.path.join(self.cache_path, gml_filename)
                self._graph = nx.read_gml(path, relabel=True)
                return self._graph
            except Exception, e:
                print e
                pass

        track = LocalAudioFile(self.filename, verbose=self.verbose)

        self._graph = earworm.do_work(track, graph_only=True,
            verbose=self.verbose, force=True)
        try:
            path = os.path.join(self.cache_path, gml_filename)
            print path
            nx.write_gml(self._graph, path)
        except Exception, e:
            print e
            pass
        return self._graph

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
