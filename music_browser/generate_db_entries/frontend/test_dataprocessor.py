#!/usr/bin/env python

import unittest

import numpy as np
from numpy.testing import *

from dataprocessor import DataProcessor, Pipeline

class TestDataProcessor(unittest.TestCase):
    def test_process_frame(self):
        class DP(DataProcessor):
            def process_frame(self, frame):
                return 2 * frame

        frames = np.random.rand(50, 2);
        dpframes = np.asarray([x for x in DP().process_sequence(frames)])
        assert_array_equal(dpframes, 2*frames)

        frames = np.random.rand(50, 2);
        dpframes = np.asarray([DP().process_frame(x) for x in frames])
        assert_array_equal(dpframes, 2*frames)

    def test_iter(self):
        class DP(DataProcessor):
            def process_sequence(self, frames):
                for frame in frames:
                    yield 2 * frame

        frames = np.random.rand(50, 2);
        dpframes = np.asarray([x for x in DP().process_sequence(frames)])
        assert_array_equal(dpframes, 2*frames)

        frames = np.random.rand(50, 2);
        dpframes = np.asarray([DP().process_frame(x) for x in frames])
        assert_array_equal(dpframes, 2*frames)


class TestPipeline(unittest.TestCase):
    def test_pipeline(self):
        class DP(DataProcessor):
            def process_frame(self, frame):
                return 2 * frame

        pipeline = Pipeline(DP(), DP())

        frames = np.random.rand(50, 2);
        dpframes = np.asarray([x for x in pipeline.process_sequence(frames)])
        assert_array_equal(dpframes, 4*frames)

        frames = np.random.rand(50, 2);
        dpframes = np.asarray([pipeline.process_frame(x) for x in frames])
        assert_array_equal(dpframes, 4*frames)


if __name__ == '__main__':
    unittest.main()
