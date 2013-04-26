#!/usr/bin/env python

# wav2png.py -- converts wave files to wave file and spectrogram images
# Copyright (C) 2008 MUSIC TECHNOLOGY GROUP (MTG)
#                    UNIVERSITAT POMPEU FABRA
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# Authors:
#   Bram de Jong <bram.dejong at domain.com where domain in gmail>

__author__ = "Bram de Jong <bram.dejong@domain.com where domain is gmail >"
# modified 3/3/2012 by Steve Rubin - srubin@cs.berkeley.edu
# for academic purposes. Mostly just deleted spectrogram visualization stuff.

import optparse, math, sys
import scikits.audiolab as audiolab
from PIL import Image, ImageDraw, ImageColor
import numpy

class AudioProcessor(object):
    def __init__(self, audio_file):
        self.audio_file = audio_file
        self.frames = audio_file.get_nframes()
        self.samplerate = audio_file.get_samplerate()
        self.channels = audio_file.get_channels()
        self.spectrum_range = None

    def read(self, start, size, resize_if_less=False):
        """ read size samples starting at start, if resize_if_less is True and less than size
        samples are read, resize the array to size and fill with zeros """
        
        add_to_start = 0
        add_to_end = 0
        
        if start < 0:
            if size + start <= 0:
                return numpy.zeros(size) if resize_if_less else numpy.array([])
            else:
                self.audio_file.seek(0)

                add_to_start = -start # remember: start is negative!
                to_read = size + start

                if to_read > self.frames:
                    add_to_end = to_read - self.frames
                    to_read = self.frames
        else:
            self.audio_file.seek(start)
        
            to_read = size
            if start + to_read >= self.frames:
                to_read = self.frames - start
                add_to_end = size - to_read
        
        try:
            samples = self.audio_file.read_frames(to_read)
        except IOError:
            return numpy.zeros(size) if resize_if_less else numpy.zeros(2)

        if self.channels > 1:
            samples = samples[:,0]

        if resize_if_less and (add_to_start > 0 or add_to_end > 0):
            if add_to_start > 0:
                samples = numpy.concatenate((numpy.zeros(add_to_start), samples), axis=1)
            
            if add_to_end > 0:
                samples = numpy.resize(samples, size)
                samples[size - add_to_end:] = 0
        
        return samples

    def peaks(self, start_seek, end_seek):
        """ read all samples between start_seek and end_seek, then find the minimum and maximum peak
        in that range. Returns that pair in the order they were found. So if min was found first,
        it returns (min, max) else the other way around. """
        
        # larger blocksizes are faster but take more mem...
        # Aha, Watson, a clue, a tradeof!
        block_size = 4096
    
        max_index = -1
        max_value = -1
        min_index = -1
        min_value = 1
    
        if end_seek > self.frames:
            end_seek = self.frames
    
        if block_size > end_seek - start_seek:
            block_size = end_seek - start_seek
            
        if block_size <= 1:
            samples = self.read(start_seek, 1)
            return samples[0], samples[0]
        elif block_size == 2:
            samples = self.read(start_seek, True)
            return samples[0], samples[1]
        
        for i in range(start_seek, end_seek, block_size):
            samples = self.read(i, block_size)
    
            local_max_index = numpy.argmax(samples)
            local_max_value = samples[local_max_index]
    
            if local_max_value > max_value:
                max_value = local_max_value
                max_index = local_max_index
    
            local_min_index = numpy.argmin(samples)
            local_min_value = samples[local_min_index]
            
            if local_min_value < min_value:
                min_value = local_min_value
                min_index = local_min_index
    
        return (min_value, max_value) if min_index < max_index else (max_value, min_value)

class WaveformImage(object):
    def __init__(self, image_width, image_height, background):
        self.image = Image.new("RGB", (image_width, image_height), background)
        
        self.image_width = image_width
        self.image_height = image_height
        
        self.draw = ImageDraw.Draw(self.image)
        self.previous_x, self.previous_y = None, None
        
        self.pix = self.image.load()

    def color_from_value(self, value):
        """ given a value between 0 and 1, return an (r,g,b) tuple """

        return ImageColor.getrgb("hsl(%d,%d%%,%d%%)" % (int( (1.0 - value) * 360 ), 80, 50))
        
    def draw_peaks(self, x, peaks):
        """ draw 2 peaks at x using the spectral_centroid for color """

        y1 = self.image_height * 0.5 - peaks[0] * (self.image_height - 4) * 0.5
        y2 = self.image_height * 0.5 - peaks[1] * (self.image_height - 4) * 0.5
        
        # Steve - testing this out - simple gray waveform
        line_color = (150,150,150)
        
        if self.previous_y != None:
            self.draw.line([self.previous_x, self.previous_y, x, y1, x, y2], line_color)
        else:
            self.draw.line([x, y1, x, y2], line_color)
    
        self.previous_x, self.previous_y = x, y2
        
        self.draw_anti_aliased_pixels(x, y1, y2, line_color)
    
    def draw_anti_aliased_pixels(self, x, y1, y2, color):
        """ vertical anti-aliasing at y1 and y2 """

        y_max = max(y1, y2)
        y_max_int = int(y_max)
        alpha = y_max - y_max_int
        
        if alpha > 0.0 and alpha < 1.0 and y_max_int + 1 < self.image_height:
            current_pix = self.pix[x, y_max_int + 1]
                
            r = int((1-alpha)*current_pix[0] + alpha*color[0])
            g = int((1-alpha)*current_pix[1] + alpha*color[1])
            b = int((1-alpha)*current_pix[2] + alpha*color[2])
            
            self.pix[x, y_max_int + 1] = (r,g,b)
            
        y_min = min(y1, y2)
        y_min_int = int(y_min)
        alpha = 1.0 - (y_min - y_min_int)
        
        if alpha > 0.0 and alpha < 1.0 and y_min_int - 1 >= 0:
            current_pix = self.pix[x, y_min_int - 1]
                
            r = int((1-alpha)*current_pix[0] + alpha*color[0])
            g = int((1-alpha)*current_pix[1] + alpha*color[1])
            b = int((1-alpha)*current_pix[2] + alpha*color[2])
            
            self.pix[x, y_min_int - 1] = (r,g,b)
            
    def save(self, filename):
        # draw a zer "zero" line
        for x in range(self.image_width):
            rgb = self.pix[x, self.image_height/2]
            if rgb == (0,0,0):
                rgb = (20,20,20)
            self.pix[x, self.image_height/2] = (rgb[0]*3, rgb[1]*3, rgb[2]*3)

        #self.draw.line([0, self.image_height/2, self.image_width, self.image_height/2], (255,255,255) )
        self.image.save(filename)


def create_png(input_filename, output_filename_w, image_width, image_height, 
        background=(255,255,255)):
    # 3/3/2012 - Steve - commented spectrogram statements out
    # because we only want the waveform
    
    audio_file = audiolab.sndfile(input_filename, 'read')

    samples_per_pixel = audio_file.get_nframes() / float(image_width)
    processor = AudioProcessor(audio_file)
    
    waveform = WaveformImage(image_width, image_height, background)
    
    for x in range(image_width):
        
        if x % (image_width/10) == 0:
            sys.stdout.write('.')
            sys.stdout.flush()
            
        seek_point = int(x * samples_per_pixel)
        next_seek_point = int( (x + 1) * samples_per_pixel)
        
        peaks = processor.peaks(seek_point, next_seek_point)
        
        waveform.draw_peaks(x, peaks)
    
    print " done"
   
    waveform.save(output_filename_w)
    #spectrogram.save(output_filename_s)


if __name__ == '__main__':
    parser = optparse.OptionParser("usage: %prog [options] input-filename", conflict_handler="resolve")
    parser.add_option("-a", "--waveout", action="store", dest="output_filename_w", type="string", help="output waveform image (default input filename + _w.png)")
    parser.add_option("-w", "--width", action="store", dest="image_width", type="int", help="image width in pixels (default %default)")
    parser.add_option("-h", "--height", action="store", dest="image_height", type="int", help="image height in pixels (default %default)")
    parser.add_option("-p", "--profile", action="store_true", dest="profile", help="run profiler and output profiling information")
    
    parser.set_defaults(image_width=500, image_height=170)

    (options, args) = parser.parse_args()

    if len(args) == 0:
        parser.print_help()
        parser.error("not enough arguments")
   
    for input_file in args:
        print "processing file %s:" % input_file
        
        try:
            output_file_w = options.output_file_w
        except AttributeError:
            output_file_w = input_file + "_w.png"
        
        args = (input_file, output_file_w, options.image_width, options.image_height)

        if not options.profile:
            create_png(*args)
        else:
            import hotshot
            from hotshot import stats
            prof = hotshot.Profile("stats")
            prof.runcall(create_png, *args)
            prof.close()
            
            s = stats.load("stats")
            s.sort_stats("time").print_stats()