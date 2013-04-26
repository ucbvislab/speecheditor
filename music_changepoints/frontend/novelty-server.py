import web
import os
import sys
import wave
import subprocess
try:
    import simplejson as json
except:
    import json

# sys.path.append('/Users/rubin/underscore/novelty-testing')
# sys.path.append('/Users/rubin/underscore/code')

import wav2png

urls = (
    '/waveform/(.*)', 'waveform',
    '/changepoints/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)', 'changepoints',
	'/songs', 'songs',
	'/', 'index',
	'', 'index'
)

app = web.application(urls, globals())
render = web.template.render('templates/')

class index:
    def GET(self):
        return render.index()

class songs:
    def GET(self):
        directory = 'static/songs/wav'
        extension = '.wav'
        file_list = [file[:-4] for file in os.listdir(directory)
                     if file.lower().endswith(extension)]
        out = {"songs": file_list}
        return json.dumps(out)
     

class waveform:
    def GET(self, song):
        filename = './static/songs/wav/' + song + '.wav'
        s = wave.open(filename, 'r')
        duration =  s.getnframes() / float(s.getframerate())
        if song + '.png' in os.listdir('./static/songs/img'):
            return json.dumps({
                "waveform": './static/songs/img/' + song + '.png',
                "duration": duration})
        
        wav2png.create_png(filename, './static/songs/img/' + song + '.png',
                           600, 100)
        
        return json.dumps({
            "waveform": './static/songs/img/' + song + '.png',
            "duration": duration
        })

   
class changepoints:
    def GET(self, song, feat, dist, k, nres, rms_weight):
        # import cProfile
        # to_run = 'novelty.novelty(\'./static/songs/wav/' + song + '.wav\',dist_fn=\'' + dist + '\',feature=\'' + feat + '\',k=' + str(int(k)) + ')'
        # cProfile.run(to_run)
        
        filename = './static/songs/wav/' + song + '.wav'
        points = cpp = subprocess.check_output(
                ['../novelty', filename, k, feat, dist, nres, rms_weight]).split('\n')

        print points
        # points = novelty.novelty(filename, dist_fn=dist,
        #                          feature=feat, k=int(k))
        out = {
            "changepoints": points
        }
        return json.dumps(out)
        
if __name__ == '__main__':
    app.run()
        