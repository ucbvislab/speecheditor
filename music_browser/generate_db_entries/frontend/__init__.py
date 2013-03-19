# Copyright (C) 2009 Ron J. Weiss (ronweiss@gmail.com)
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

"""frontend: Audio feature extraction framework.

This module makes it easy to chain simple processing elements together
to form complex feature extractors.  It makes extensive use of
generator pipelines and therefore has a fairly minimal memory
footprint (frames of audio are processed in turn -- there is no need
to multiply huge matrices togeher as you would typically do in Matlab,
e.g. multiply a high frequency resolution STFT with a short hop with a
warping matrix to generate mel frequency , together).

The most common usage of is through the Pipeline() class which is used
to chain together a set of simple generators to create compound
feature extractors as follows:

>>> featext = Pipeline(AudioSource(filename='path/to/file'),
                       Mono(),
                       Resample(ratio=0.5),
                       STFT(nfft=1024, nhop=256))

Some useful predefined Pipelines include:
    STFT          -- Short-time Fourier Transform
    MFCC          -- Mel-frequency Cepstral Coefficient features
    Chroma        -- pitch class profile features which summarize a
                     signal's harmonic content

For interactive uses, it is often preferable to interact with
individual data processors using arrays directly without depending on
the iterator protocol.  All DataProcessor classes in this module are
therefore also exported in form that lets you use them as standalone
functions.  The naming convention used throughout this module is
CamelCase for DataProcessors to be used in a Pipeline and lowercase
for standalone functions.
"""

__author__ = "Ron J. Weiss <ronweiss@gmail.com>"
__version__ = "0.2"


from sources import *
from basic import *
from chroma import *
from mfcc import *
alldps = locals().copy()

import functools
import inspect
from dataprocessor import *


def _wrap_docstring(fun, dpcls):
    if fun.__doc__ is None:
        fun.__doc__ = ""
    fun.__doc__ = ("Standalone function version of %s.\n\n%s"
                   % (dpcls.__name__, fun.__doc__))

def _dataprocessor_to_function(dpcls):
    @functools.wraps(dpcls)
    def fun(frames, *args, **kwargs):
        dp = dpcls(*args, **kwargs)
        return np.asarray([x for x in dp.process_sequence(frames)])
    _wrap_docstring(fun, dpcls)
    return fun

def _source_to_function(dpcls):
    @functools.wraps(dpcls)
    def fun(*args, **kwargs):
        dp = dpcls(*args, **kwargs)
        return np.asarray([x for x in dp])
    _wrap_docstring(fun, dpcls)
    return fun

__all__ = []
for clsname, cls in alldps.iteritems():
    if ((not clsname[0].isupper())
        or (not inspect.isclass(cls) and not inspect.isfunction(cls))):
        continue

    funname = clsname.lower()
    if not funname in alldps:
        if issubclass(cls, Source):
            exec('%s = _source_to_function(%s)' % (funname, clsname))
        else:
            exec('%s = _dataprocessor_to_function(%s)' % (funname, clsname))

    __all__.append(clsname)
    __all__.append(funname)
