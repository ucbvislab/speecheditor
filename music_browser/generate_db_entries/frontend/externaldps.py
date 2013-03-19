import numpy
import scipy

import dataprocessor


# Import a bunch of numpy functions directly.
external_funcs = {'Abs': ('numpy.abs', numpy.abs),
                  'Diff': ('numpy.diff', numpy.diff),
                  'Exp': ('numpy.exp', numpy.exp),
                  'Flatten': ("numpy's flatten", lambda x: x.flatten()),
                  'FFT': ('numpy.fft.fft', numpy.fft.fft),
                  'IFFT': ('numpy.fft.ifft', numpy.fft.ifft),
                  'RFFT': ('numpy.fft.rfft', numpy.fft.rfft),
                  'IRFFT': ('numpy.fft.irfft', numpy.fft.irfft),
                  'Real': ('numpy.real', numpy.real),
                  'Imag': ('numpy.imag', numpy.imag),
                  'Square': ('numpy.square', numpy.square),
                  'Sqrt': ('numpy.sqrt', numpy.sqrt),
                  }
                  
__all__ = external_funcs.keys()

for local_name, tpl in external_funcs.iteritems():
    name, func = tpl
    class ExternalDP(dataprocessor.DataProcessor):
        __doc__ = "DataProcessor wrapper around %s." % name

        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def _call_external_func(self, frame, external_func=func):
            return external_func(frame, *self.args, **self.kwargs)

        def process_frame(self, frame):
            return self._call_external_func(frame)

    exec("ExternalDP.__name__ = '%s'" % local_name)
    exec("%s = ExternalDP" % local_name)
