#!/usr/bin/env python

try:
    import simplejson as json
except:
    import json
import urllib
import subprocess
import os
import web
from web.contrib.template import render_mako

import sys
sys.path.append("/home/ubuntu/speecheditor")

import reauthor_speech
import duplicate_lines
from wav2png import create_png

try:
    from app_path import APP_PATH
except:
    APP_PATH = ''

urls = (
    '/', 'home',
    '/reauthor', 'reauthor',
    '/breaths', 'breaths',
	'/ping', 'ping',
    '/download/(.*)', 'download',
    '/dupes', 'dupes',
    '/alignment/(.*)', 'alignment',
)

render = render_mako(
    directories=['templates'],
    input_encoding='utf-8',
    output_encoding='utf-8'
)

class ping:
	def GET(self):
		return sys.path

class download:
    def GET(self, name):
        web.header('Content-Type','audio/mpeg')
        web.header('Pragma', 'public')
        web.header('Expires', '0')
        web.header('Cache-Control', 'must-revalidate, post-check=0, pre-check=0')
        web.header('Cache-Control', 'public')
        web.header('Content-Description', 'File Transfer')
        web.header('Content-Disposition', 'attachment; filename=' + name + '.mp3;')
        web.header('Content-Transfer-Encoding', 'binary')
        web.header('Content-Length', os.stat(APP_PATH + 'static/tmp/' + name + '.mp3').st_size)
        return open(APP_PATH + 'static/tmp/' + name + '.mp3', 'r').read()


class home:
    def GET(self):
        return render.reauthor_web()


class alignment:
    def GET(self, name):
        try:
            out = json.load(
                open("%sstatic/%s-breaths.json" % (APP_PATH, name), 'r')
            )
        except:
            algn = json.load(
                open("%sstatic/%s.json" % (APP_PATH, name), 'r')
            )["words"]
            new_alignment = reauthor_speech.render_pauses(
                "%sstatic/%s44.wav" % (APP_PATH, name), algn)
            out = {
                "words": new_alignment
            }
            json.dump(out,
                open('%sstatic/%s-breaths.json' % (APP_PATH, name), 'w'))
        finally:
            web.header("Content-type", 'application/json')
            out["speechText"] = '%s-breaths.json' % name
            return json.dumps(out)


class reauthor:
    def POST(self):
        post_data = urllib.unquote(web.data())
        dat = json.loads(post_data)
        
        with open(APP_PATH + 'static/' + dat["speechText"], 'r') as f:
            af = json.loads(f.read())["words"]
            
        ef = dat["speechReauthor"]["words"]
        

        timing = reauthor_speech.rebuild_audio(APP_PATH + 'static/' +
            dat["speechAudio"], af, ef,
            cut_to_zc=True,
            out_file=APP_PATH + "static/tmp/" + dat["outfile"],
            samplerate=dat["speechSampleRate"]
        )
        subprocess.call('lame -f -b 128 ' + APP_PATH + 'static/tmp/'
            + dat["outfile"] + '.wav', shell=True
        )
        create_png(APP_PATH + 'static/tmp/' + dat["outfile"] + '.wav',
            APP_PATH + 'static/tmp/' + dat["outfile"] + '.png',
            dat["timelineWidth"], dat["timelineHeight"]
        )   
        subprocess.call('rm ' + APP_PATH + 'static/tmp/' +
            dat["outfile"] + '.wav', shell=True
        )
        web.header('Content-type', 'application/json')
        return json.dumps( {
            "url": 'tmp/' + dat["outfile"] + '.mp3',
            "img": 'tmp/' + dat["outfile"] + '.png',
            "timing": timing
        } )

class dupes:
    def POST(self):
        post_data = urllib.unquote(web.data())
        dat = json.loads(post_data)
        with open(APP_PATH + 'static/' + dat["speechText"], 'r') as f:
            af = json.load(f)["words"]

        web.header('Content-type', 'application/json')
        return json.dumps(duplicate_lines.get_dupes(af))

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
