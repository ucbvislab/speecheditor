#!/usr/bin/env python

try:
    import simplejson as json
except:
    import json
import urllib
import subprocess

import web
from web.contrib.template import render_mako

import sys
sys.path.append("/home/ubuntu/speecheditor")
from reauthor_speech import rebuild_audio, find_breaths

urls = (
    '/', 'home',
    '/reauthor', 'reauthor',
    '/breaths', 'breaths',
	'/ping', 'ping',
)



render = render_mako(
    directories=['templates'],
    input_encoding='utf-8',
    output_encoding='utf-8',
)

class ping:
	def GET(self):
		return sys.path

class home:
    def GET(self):
        return render.reauthor_web()

class reauthor:
    def POST(self):
        post_data = urllib.unquote(web.data())
        dat = json.loads(post_data)
        
        with open('static/' + dat["speechText"], 'r') as f:
            af = json.loads(f.read())["words"]
        ef = dat["speechReauthor"]["words"]
        
        timing = rebuild_audio('static/' + dat["speechAudio"], af, ef,
            cut_to_zc=True,
            out_file="static/out-zc",
            samplerate=dat["speechSampleRate"]
        )
        
        subprocess.call('lame -f -b 128 --nohist static/out-zc.wav', shell=True)

        web.header('Content-type', 'application/json')
        return json.dumps( {
            "url": 'out-zc.mp3',
            "timing": timing
        } )

class breaths:
    def GET(self):
        params = web.input()
        with open('.' + params.speechText, 'r') as f:
            af = json.loads(f.read())["words"]
        result = find_breaths(params.speechAudio, af)
        return json.dumps(result)

app = web.application(urls, globals())
application = app.wsgifunc()

if __name__=="__main__":
    app.run()
