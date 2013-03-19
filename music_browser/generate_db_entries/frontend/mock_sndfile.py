class MockSndfile(object):
    """
    Wraps an audiolab Sndfile interface around a NumPy array.

    Using this class enables a consistent interface through the
    feature extraction pipeline for signals already in memory as well
    as sound files read from disk or audio devices. 
    """
    def __init__(self, array, samplerate=None):
        self.nframes = len(array)
        try:
            self.channels = len(array[0])
        except TypeError:
            self.channels = 1

        self._array = array
        self._curr_index = 0

        self.samplerate = samplerate
        self.encoding = None
        self.endianness = None
        self.file_format = None
        self.format = None
        
    def read_frames(self, nframes, dtype=None):
        end = self._curr_index + nframes
        if self._curr_index > self.nframes or end > self.nframes:
            nread = self.nframes - self._curr_index
            self._curr_index += nread
            raise (RuntimeError, 'Asked %d frames, read %d' % (nframes, nread))

        start = self._curr_index
        self._curr_index += nframes
        frames = self._array[start:end]
        if dtype:
            frames = frames.astype(dtype)
            # BUG FIXED from:
            # frames.dtype = dtype
        return frames
            
    def write_frames(self, frames):
        pass

    def seek(self, offset, whence=0, mode='r'):
        if whence == 0:
            new_curr_index = offset
        elif whence == 1:
            new_curr_index = self._curr_index + offset
        elif whence == 2:
            new_curr_index = self.nframes + offset
        else:
            raise (ValueError, 'whence must be 0, 1, or 2')
        
        if 0 <= new_curr_index < self.nframes:
            self._curr_index = new_curr_index
        else:
            raise (IOError, 'Tried to seek too far')

        return self._curr_index
    
    def close(self):
        pass

    def sync(self):
        pass

