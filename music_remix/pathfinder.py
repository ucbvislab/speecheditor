import sys
import functools

import numpy as N
import networkx as nx


def memoize(obj):

    cache = obj.cache = {}

    @functools.wraps(obj)
    def memoizer(*args, **kwargs):
        if args not in cache:
            cache[args] = obj(*args, **kwargs)
        return cache[args]
    return memoizer


class PathFinder(object):

    def __init__(self, sim_mat=None, graph=None,
        start=None, end=None, length=None, nodes=None):

        self.graph = graph
        self.sim_mat = sim_mat
        self.start = start
        self.end = end
        self.length = length
        if nodes is not None:
            self.nodes = nodes
        else:
            self.nodes = sorted(graph.nodes(), key=float)

    def find(self, length_padding=5, avoid=None):
        self.build_table(length_padding=length_padding, bad_nodes=avoid)
        res = self.C[self.end,
                     self.length - 1 - length_padding:
                     self.length + length_padding]
                     
        if self.graph is None:
            res -= N.arange(len(res))
            
        print "COSTS: ", [[i, res[i]] for i in range(len(res))]
            
        best_idx = N.argmin(res)
        
        print "best_idx", best_idx
        if N.isfinite(res[best_idx]):
            return self.reconstruct_path(self.end,
                self.length - 1 - length_padding + best_idx), res[best_idx]
        return None, None

    def reconstruct_path(self, end, length):
        path = []
        path.append(end)
        node = end
        while length > 0:
            node = self.prev_node[node, length]
            path.append(node)
            length -= 1
        return [self.nodes[int(n)] for n in reversed(path)]

    def build_trans_cost(self):
        # create transition cost table
        # note: nodes are sorted in music-chronological order
        trans_cost = N.array(
            nx.adjacency_matrix(self.graph, nodelist=self.nodes))

        # cost for no transition: infinity
        trans_cost[N.where(trans_cost == 0)] = N.inf

        # cost for perfect transition (next frame): 0
        for i in range(len(self.nodes) - 1):
            trans_cost[i, i + 1] = 0

        # cost for other transition: 1

        self.trans_cost = trans_cost

    def build_table(self, length_padding=0, bad_nodes=None):
        # bad_nodes are nodes that you MAY NOT pass through
        # - in our case, these are other change points


        # create transition cost table
        # note: nodes are sorted in music-chronological order
        
        if self.sim_mat is None:
        
            trans_cost = N.array(nx.adjacency_matrix(self.graph,
                nodelist=self.nodes))

            # cost for no transition: infinity
            trans_cost[N.where(trans_cost == 0)] = N.inf

            # cost for perfect transition (next frame): 0
            for i in range(len(self.nodes) - 1):
                trans_cost[i, i + 1] = 0

            # cost for other transition: 1


        else:
            trans_cost = self.sim_mat
            
            # shift it over
            trans_cost[:, 1:] = trans_cost[:, :-1]
            trans_cost[:, 0] = N.inf


        # cost for bad nodes: inf
        for node in bad_nodes:
            # trans_cost[node, :] = N.inf
            trans_cost[:, node] = N.inf
            
        print "Avoiding nodes", bad_nodes
        
        # no self-jumps
        N.fill_diagonal(trans_cost, N.inf)

        # define the table dimensions
        C = N.zeros((len(self.nodes), self.length + length_padding))
        prev_node = N.zeros((len(self.nodes), self.length + length_padding))

        C[:, 0] = N.inf
        C[self.start, 0] = 0

        ks = range(len(self.nodes))

        for l in xrange(1, self.length + length_padding):
            for n_i in xrange(len(self.nodes)):

                costs = trans_cost[:, n_i] + C[:, l - 1]
                
                if l not in range(self.length - length_padding,
                    self.length + length_padding):
                    costs[self.end] = N.inf

                # oh man, this was SO slow
                # costs = [trans_cost[k, n_i] + C[k, l - 1] for k in ks]

                min_node = N.argmin(costs)
                C[n_i, l] = costs[min_node]
                prev_node[n_i, l] = min_node

        self.C = C
        self.prev_node = prev_node

    @memoize
    def C(self, node, length):
        """this doesn't help because it involves many function calls"""
        if length == 0:
            if node == self.start:
                return (0, node)
            else:
                return (N.inf, N.inf)
        ks = range(len(self.nodes))

        costs = [self.trans_cost[k, node] +
                 self.C(k, length - 1)[0]
                 for k in ks]
        min_node = N.argmin(costs)

        return (costs[min_node], min_node)


if __name__ == '__main__':
    graph = nx.read_gml(sys.argv[1], relabel=True)
    start = int(sys.argv[2])
    end = int(sys.argv[3])
    length = int(sys.argv[4])
    pf = PathFinder(graph=graph,
                    start=start,
                    end=end,
                    length=length)
    print pf.find()
