#!/usr/bin/env python

"""Tests for frontend feature extraction pipeline."""

import unittest

import numpy

from numpy.testing import *

from mock_sndfile import MockSndfile

class TestMockSndfile(unittest.TestCase):
    def test_channels(self):
        samples = numpy.arange(200, dtype=numpy.float32).reshape((100,2))
        sndfile = MockSndfile(samples)
        self.assertEqual(sndfile.channels, 2)

        samples = numpy.arange(200, dtype=numpy.float32)
        sndfile = MockSndfile(samples)
        self.assertEqual(sndfile.channels, 1)

    def test_read_frames(self):
        samples = numpy.arange(200).reshape((100,2))
        samples = (samples  - 100) / 200.0
        sndfile = MockSndfile(samples)

        frames = sndfile.read_frames(10)
        assert_array_equal(samples[:10,:], frames)
        frames = sndfile.read_frames(20)
        assert_array_equal(samples[10:30,:], frames)
        frames = sndfile.read_frames(70)
        assert_array_equal(samples[30:,:], frames)

    def test_read_frames_type_conversion(self):
        samples = numpy.arange(200, dtype=numpy.float32)
        sndfile = MockSndfile(samples)
        frames = sndfile.read_frames(len(samples), dtype=numpy.int16)
        import pdb; pdb.set_trace()
        
        self.assert_(isinstance(frames[0], numpy.int16))
        import pdb; pdb.set_trace()
        
        assert_array_equal(numpy.int16(samples), frames)

    def test_read_frames_past_end(self):
        samples = numpy.arange(200)
        sndfile = MockSndfile(samples)
        self.assertRaises(RuntimeError, sndfile.read_frames, len(samples) + 1)
    
    def test_seek(self):
        # Based on TestSeek class from audiolab's test_sndfile.py.
        samples = numpy.arange(10000)
        sndfile = MockSndfile(samples)
        nframes = sndfile.nframes

        bufsize = 1024

        buf = sndfile.read_frames(bufsize)
        sndfile.seek(0)
        buf2 = sndfile.read_frames(bufsize)
        assert_array_equal(buf, buf2)

        # Now, read some frames, go back, and compare buffers
        # (check whence == 1 == SEEK_CUR)
        sndfile = MockSndfile(samples)
        sndfile.read_frames(bufsize)
        buf = sndfile.read_frames(bufsize)
        sndfile.seek(-bufsize, 1)
        buf2 = sndfile.read_frames(bufsize)
        assert_array_equal(buf, buf2)

        # Now, read some frames, go back, and compare buffers
        # (check whence == 2 == SEEK_END)
        sndfile = MockSndfile(samples)
        buf = sndfile.read_frames(nframes)
        sndfile.seek(-bufsize, 2)
        buf2 = sndfile.read_frames(bufsize)
        assert_array_equal(buf[-bufsize:], buf2)

        # Try to seek past the end.
        self.assertRaises(IOError, sndfile.seek, len(samples) + 1)


if __name__ == '__main__':
    unittest.main()
