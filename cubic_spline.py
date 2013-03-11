# ported to python from coffeescript from
# http://blog.mackerron.com/2011/01/01/javascript-cubic-splines/

import numpy as N

class MonotonicCubicSpline(object):
    
    def __init__(self, x, y):
        n = len(x)
        x = N.array(map(float, x))
        y = N.array(map(float, y))
        delta = []
        m = []
        alpha = []
        beta = []
        dist = []
        tau = []
        
        delta = (y[1:] - y[:-1]) / (x[1:] - x[:-1])
        m = N.r_[delta[0], (delta[:-1] + delta[1:]) / 2.0, delta[n - 2]]
        
        to_fix = N.where(delta == 0)[0]
        m[to_fix] = 0
        m[to_fix + 1] = 0

        alpha = m[:-1] / delta
        beta = m[1:] / delta
        dist = N.power(alpha, 2) + N.power(beta, 2)
        tau = 3.0 / N.sqrt(dist)
            
        to_fix = N.where(dist > 9)[0]
        m[to_fix] = tau[to_fix] * alpha[to_fix] * delta[to_fix]
        m[to_fix + 1] = tau[to_fix] * beta[to_fix] * delta[to_fix]
        
        self.x = x
        self.y = y
        self.m = m
    
    def interpolate_array(self, x):
        out = N.zeros(N.shape(x))
        for i, elt in enumerate(x):
            out[i] = self.interpolate(elt)
        return out

    def interpolate(self, x):
        x = float(x)
        i = N.where(self.x[:-1] <= x)[0][-1]
        h = self.x[i + 1] - self.x[i]
        t = (x - self.x[i]) / h
        t2 = N.power(t, 2)
        t3 = N.power(t, 3)
        h00 =  2 * t3 - 3 * t2 + 1
        h10 =      t3 - 2 * t2 + t
        h01 = -2 * t3 + 3 * t2
        h11 =      t3  -    t2
        return h00 * self.y[i] + h10 * h * self.m[i] +\
             h01 * self.y[i + 1] + h11 * h * self.m[i + 1]

        
        