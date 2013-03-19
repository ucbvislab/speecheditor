import numpy

# Window functions
def rectangular(N):
    return numpy.ones(N)

def hamming(N):
    return 0.54 - 0.46 * numpy.cos(2 * numpy.pi * numpy.arange(N) / (N - 1))

def hann(N):
    return 0.5 * (1 - numpy.cos(2 * numpy.pi * numpy.arange(N) / (N - 1)))

