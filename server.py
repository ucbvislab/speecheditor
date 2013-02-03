try:
    import simplejson as json
except:
    import json
import urllib

import web
from web.contrib.template import render_mako

from reauthor_speech import rebuild_audio, find_breaths

urls = (
    '/', 'home',
    '/reauthor', 'reauthor',
    '/breaths', 'breaths',
	'/ping', 'ping',
)

#app = web.application(urls, globals())

render = render_mako(
    directories=['templates'],
    input_encoding='utf-8',
    output_encoding='utf-8',
)

class ping:
	def GET(self):
		return "pong"

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

        web.header('Content-type', 'application/json')
        return json.dumps( {
            "url": 'out-zc.wav',
            "timing": timing
        } )

class breaths:
    def GET(self):
        params = web.input()
        with open('.' + params.speechText, 'r') as f:
            af = json.loads(f.read())["words"]
        result = find_breaths(params.speechAudio, af)
        return json.dumps(result)

app = web.application(urls, globals(), autoreload=False)
application = app.wsgifunc()

if __name__ == '__main__':
    app.run()
