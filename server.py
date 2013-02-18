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

from radiotool.composer import Track, Song, Speech, Composition, Segment

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
    '/uploadSong', 'UploadSong',
)


render = render_mako(directories=['templates'],
                     input_encoding='utf-8',
                     output_encoding='utf-8')


class ping:

    def GET(self):
        return sys.path


class UploadSong:

    def POST(self):
        x = web.input(song={})
        
        web.debug(x['song'].filename) # This is the filename
        # web.debug(x['song'].value) # This is the file contents
        # web.debug(x['song'].file.read()) # Or use a file(-like) object
        
        upload_path = APP_PATH + 'static/uploads/'
        
        # save file
        if 'song' in x:
            file_path = x.song.filename.replace('\\', '/')
            filename = file_path.split('/')[-1]
            full_name = upload_path + filename
            with open(full_name, 'wb') as fout:
                fout.write(x.song.file.read())
        
            # convert to wav
            subprocess.call(
                'lame --decode "%s"' % full_name, shell=True)
                
            wav_name = ".".join(full_name.split('.')[:-1]) + '.wav'
        
            # wav2json
            subprocess.call(
                'wav2json -p 2 -s 10000 --channels mid -n -o "%s" "%s"' %
                (upload_path + 'wfData/' + filename + '.json', wav_name),
                shell=True)

            out = {
                "path": "uploads/" + filename,
                "name": file_path.split('.')[0]
            }

            # get length of song upload
            track = Track(wav_name, "track")
            out["dur"] = track.total_frames() / float(track.sr()) * 1000.0

            # delete wav
            subprocess.call('rm "%s"' % wav_name, shell=True)

            # read waveform data json
            with open(upload_path + 'wfData/' + filename + '.json', 'r') as wf:
                out["wfData"] = json.load(wf)["mid"]

            web.header("Content-type", "application/json")
            return json.dumps(out)


class download:

    def GET(self, name):
        web.header('Content-Type', 'audio/mpeg')
        web.header('Pragma', 'public')
        web.header('Expires', '0')
        web.header('Cache-Control',
                   'must-revalidate, post-check=0, pre-check=0')
        web.header('Cache-Control', 'public')
        web.header('Content-Description', 'File Transfer')
        web.header('Content-Disposition',
                   'attachment; filename=' + name + '.mp3;')
        web.header('Content-Transfer-Encoding', 'binary')
        web.header('Content-Length',
                   os.stat(APP_PATH + 'static/tmp/' + name + '.mp3').st_size)
        return open(APP_PATH + 'static/tmp/' + name + '.mp3', 'r').read()


class home:

    def GET(self):
        return render.reauthor_web()


class alignment:

    def GET(self, name):
        try:
            out = json.load(
                open("%sstatic/%s-breaths.json" % (APP_PATH, name), 'r'))
        except Exception, e:
            print e
            algn = json.load(
                open("%sstatic/%s.json" % (APP_PATH, name), 'r'))["words"]
            new_alignment = reauthor_speech.render_pauses(
                "%sstatic/%s44.wav" % (APP_PATH, name), algn)
            out = {"words": new_alignment}
            json.dump(out,
                open('%sstatic/%s-breaths.json' % (APP_PATH, name), 'w'))

        web.header("Content-type", 'application/json')
        out["speechText"] = '%s-breaths.json' % name
        return json.dumps(out)


class reauthor:

    def POST(self):
        post_data = urllib.unquote(web.data())
        dat = json.loads(post_data)
        
        tracks = dat["exportedTimeline"]
        result = {}
        
        c = Composition(channels=1)
        
        for t in tracks:
            if t["waveformClass"] == "textAlignedWaveform":
                score_start = t["scoreStart"]
                
                with open(APP_PATH + 'static/' + dat["speechText"], 'r') as f:
                    af = json.loads(f.read())["words"]
                ef = dat["speechReauthor"]["words"]

                result = reauthor_speech.rebuild_audio(APP_PATH + 'static/' +
                    dat["speechAudio"], af, ef,
                    cut_to_zc=True,
                    tracks_and_segments=True,
                    # out_file=APP_PATH + "static/tmp/" + dat["outfile"],
                    samplerate=dat["speechSampleRate"],
                    score_start=score_start
                    )
                
                c.add_tracks(result["tracks"])
                c.add_score_segments(result["segments"])
            
            elif t["waveformClass"] == "waveform":
                score_start = t["scoreStart"]
                track_start = t["wfStart"]
                duration = t["duration"]
                filename = APP_PATH + "static/" + t["filename"]
                
                wav_fn = filename
                
                if filename.lower().endswith('.mp3'):
                    subprocess.call('lame --decode "%s"' % filename, shell=True)
                    wav_fn = ".".join(filename.split('.')[:-1]) + ".wav"
                    
                track = Track(wav_fn, t["name"])
                segment = Segment(track, score_start, track_start, duration)
                
                c.add_track(track)
                c.add_score_segment(segment)
        
        c.output_score(
            adjust_dynamics=False,
            filename=APP_PATH + "static/tmp/" + dat["outfile"],
            channels=1,
            filetype='wav',
            samplerate=result["samplerate"],
            separate_tracks=False)
        
        subprocess.call('lame -f -b 128 ' + APP_PATH + 'static/tmp/'
            + dat["outfile"] + '.wav', shell=True)
        create_png(APP_PATH + 'static/tmp/' + dat["outfile"] + '.wav',
            APP_PATH + 'static/tmp/' + dat["outfile"] + '.png',
            dat["timelineWidth"], dat["timelineHeight"])
        subprocess.call('rm ' + APP_PATH + 'static/tmp/' +
            dat["outfile"] + '.wav', shell=True)
        web.header('Content-type', 'application/json')
        return json.dumps({
            "url": 'tmp/' + dat["outfile"] + '.mp3',
            "img": 'tmp/' + dat["outfile"] + '.png',
            "timing": result["timing"] })


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

if __name__ == "__main__":
    app.run()
