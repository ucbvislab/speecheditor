try:
    import simplejson as json
except:
    import json
import urllib
import subprocess
import os

import sys
sys.path.append("/home/ubuntu/speecheditor")
sys.path.append("/var/www/html/srubin/speecheditor")

import reauthor_speech
import duplicate_lines

from radiotool.composer import Track, Song, Speech, Composition, Segment

try:
    from app_path import APP_PATH
except:
    APP_PATH = ''

from flask import Flask, request, make_response, jsonify, Response
from werkzeug import secure_filename
app = Flask(__name__)

@app.route('/reauthor', methods=['POST'])
def reauthor():
    if request.method == 'POST':
        post_data = urllib.unquote(request.data)
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
        
        # get the new wav2json data, maybe

        # create_png(APP_PATH + 'static/tmp/' + dat["outfile"] + '.wav',
        #     APP_PATH + 'static/tmp/' + dat["outfile"] + '.png',
        #     dat["timelineWidth"], dat["timelineHeight"])

        subprocess.call('rm ' + APP_PATH + 'static/tmp/' +
            dat["outfile"] + '.wav', shell=True)
        return jsonify(url='tmp/' + dat["outfile"] + '.mp3',
                       img='tmp/' + dat["outfile"] + '.png',
                       timing=result["timing"])


@app.route('/ping')
def ping():
    return str(sys.path)


@app.route('/download/<name>')
def download(name):
    # should investigate flask's send_file
    
    resp = make_response(
        open(APP_PATH + 'static/tmp/' + name + '.mp3', 'r').read())
    resp.headers['Content-Type'] = 'audio/mpeg'
    resp.headers['Pragma'] = 'public'
    resp.headers['Expires'] = '0'
    resp.headers['Cache-Control'] = 'must-revalidat, post-check=0, pre-check=0'
    resp.headers['Cache-Control'] = 'public'
    resp.headers['Content-Description'] = 'File Transfer'
    resp.headers['Content-Disposition'] =\
        'attachment; filename=' + name + '.mp3'
    resp.headers['Content-Transfer-Encoding'] = 'binary'
    resp.headers['Content-Length'] =\
        os.stat(APP_PATH + 'static/tmp/' + name + '.mp3').st_size
    return resp


@app.route('/dupes', methods=['POST'])
def dupes():
    if request.method == 'POST':
        post_data = urllib.unquote(request.data)
        dat = json.loads(post_data)
        with open(APP_PATH + 'static/' + dat["speechText"], 'r') as f:
            af = json.load(f)["words"]

        return Response(json.dumps(duplicate_lines.get_dupes(af)),
            mimetype="application/json")
    return


@app.route('/uploadSong', methods=['POST'])
def upload_song():
    if request.method == 'POST':
        upload_path = APP_PATH + 'static/uploads/'
        f = request.files['song']
        file_path = f.filename.replace('\\', '/')
        filename = secure_filename(f.filename)
        full_name = upload_path + filename
        f.save(full_name)
        
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

        return jsonify(**out)
    return


@app.route('/alignment/<name>')
def alignment(name):
    print "HERE"
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

    out["speechText"] = '%s-breaths.json' % name
    return jsonify(**out)


if __name__ == '__main__':
    app.run(debug=True)
