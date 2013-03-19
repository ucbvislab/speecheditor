#!/usr/bin/env python
import unittest

import numpy as np
from numpy.testing import *

from dataprocessor import Pipeline
import basic


class TestFramer(unittest.TestCase):
    def _test_framer(self, n, nbuf, nwin, nhop):
        samples = np.arange(n)
        frames = basic.Framer(nwin, nhop).process_sequence(samples)

        nframes = int(np.ceil(1.0 * len(samples) / nhop))
        for x in range(nframes):
            curr_frame = frames.next()
            
            if x * nhop + nwin < len(samples):
                curr_samples = samples[x * nhop : x * nhop + nwin]
            else:
                # Make sure zero padding is correct.
                curr_samples = samples[x*nhop:]
                nsamples = len(curr_samples)
                curr_samples = np.concatenate((curr_samples,
                                                  [0] * (nwin - nsamples)))

            assert_array_equal(curr_frame, curr_samples)
        self.assertRaises(StopIteration, frames.next)

    def test_framer_small_buf_1hop(self):
        self._test_framer(90, 5, 20, 1)
    def test_framer_large_buf_1hop(self):
        self._test_framer(90, 50, 20, 1)
    def test_framer_quarter_hop(self):
        self._test_framer(90, 50, 20, 5)
    def test_framer_half_hop(self):
        self._test_framer(90, 50, 20, 10)
    def test_framer_full_hop(self):
        self._test_framer(90, 50, 20, 20)
    def test_framer_relatively_prime(self):
        self._test_framer(500, 101, 23, 7)


class TestOverlapAdd(unittest.TestCase):
    def test_framer_overlapadd(self, n=102400, nwin=1025, nhop=256):
        """

        nwin must be odd and nhop must be (nwin - 1) / 4 for
        perfect reconstruction with a hanning window."""
        #samples = np.random.rand(n)
        #samples = np.arange(n)
        samples = np.sin(2*np.pi * np.arange(0, n) * 1e-3)
        frames = np.asarray(
            [x for x in basic.Framer(nwin, nhop).process_sequence(samples)])

        output_frames = Pipeline(frames,
                                 basic.Window(),
                                 basic.Window(),
                                 basic.OverlapAdd(nwin, nhop)).toarray()
        
        # Chop off first and last few frames to ignore partial window effects.
        skipframes = (nwin - nhop) / nhop
        start = nhop*skipframes
        end = len(samples) - start
        assert_array_almost_equal(samples[start:end] * 1.5,
                                  output_frames.flatten()[start:end], decimal=2)


class TestSimpleComponents(unittest.TestCase):
    def test_mono(self):
        nsamp = 1000
        nframes = 10
        stereo_frames = np.random.rand(nframes, nsamp/nframes, 2)

        gen = basic.Mono().process_sequence(stereo_frames)
        mono_frames = np.array([x for x in gen])

        self.assert_(stereo_frames.shape != mono_frames.shape)
        self.assertEqual(mono_frames.shape, (nframes, nsamp/nframes))

    def test_fft_ifft_perfect_reconstruction(self):
        nsamp = 1024
        nfft = 32
        for nbuf in [8, 16, 32]:
            frames = np.random.rand(nsamp/nbuf, nbuf)

            gen = basic.IFFT(nfft).process_sequence(
                basic.FFT(nfft).process_sequence(frames))
            test_frames = np.array([x for x in gen])

            assert_array_almost_equal(frames, test_frames[:,:nbuf])


class TestCompoundFeatures(unittest.TestCase):
    def test_stft_istft_perfect_reconstruction(self, n=102400, nwin=1025,
                                               nhop=256, winfun=np.hanning):
        samples = np.random.rand(n)
        #samples = np.arange(n)
        #samples = np.sin(2*np.pi * np.arange(0, n) * 1e-3)

        output_frames = Pipeline(
            samples, basic.STFT(nwin, nhop=nhop, winfun=winfun),
            basic.ISTFT(nwin, nhop=nhop, winfun=winfun)).toarray()

        # Chop off first and last few frames to ignore partial window effects.
        skipframes = (nwin - nhop) / nhop
        start = nhop*skipframes
        end = len(samples) - start
        assert_array_almost_equal(
            samples[start:-start] * 1.5,
            output_frames.flatten()[start:end])


if __name__ == '__main__':
    unittest.main()
