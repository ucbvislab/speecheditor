try:
    import simplejson as json
except:
    import json
import urllib
import subprocess
import os
import eyed3
import shutil

import sys
sys.path.append("/home/ubuntu/speecheditor")
sys.path.append("/var/www/html/srubin/speecheditor")

import numpy as N

import reauthor_speech
import duplicate_lines
from music_remix.music_remix import MusicGraph
from music_remix.novelty_simple import novelty
from music_remix.changepoint_paths import best_changepoint_path
from cubic_spline import MonotonicCubicSpline

from radiotool.composer import\
    Track, Song, Speech, Composition, Segment, RawVolume


try:
    from app_path import APP_PATH
except:
    APP_PATH = ''

from flask import Flask, request, make_response, jsonify, Response, render_template
from werkzeug import secure_filename
app = Flask(__name__)
app.debug = True

# load the app for music browsing

@app.route('/')
def index():
    return render_template('index.html')

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

                crossfades = True
                if "crossfades" in dat:
                    crossfades = dat["crossfades"]

                args = {
                    "cut_to_zc": False,
                    "samplerate": dat["speechSampleRate"],
                    "tracks_and_segments": True,
                    "score_start": score_start,
                    "crossfades": crossfades
                }

                speech_audio_path = APP_PATH + 'static/' + dat["speechAudio"]

                result = reauthor_speech.rebuild_audio(
                    speech_audio_path, af, ef, **args)
                
                c.add_tracks(result["tracks"])
                c.add_score_segments(result["segments"])
            
            elif t["waveformClass"] == "musicWaveform":
                # handle music authored per beat
                starts = t["extra"]["starts"]
                durs = t["extra"]["durations"]
                dists = t["extra"]["distances"]
                vx = N.array(t["extra"]["volume"]["x"])
                vy = N.array(t["extra"]["volume"]["y"])
                    
                score_start = t["scoreStart"]
                filename = APP_PATH + "static/" + t["filename"]
                
                if filename.lower().endswith('.mp3'):
                    wav_fn = ".".join(filename.split('.')[:-1]) + ".wav"
                    if not os.path.isfile(wav_fn):
                        subprocess.call('lame --decode "%s"'
                            % filename, shell=True)
                
                track = Track(wav_fn, t["name"])
                c.add_track(track)
                current_loc = float(score_start)
                
                # create the spline interpolator
                vx = vx / 1000.0 * track.sr()
                # cdf = MonotonicCubicSpline(vx, vy)
                
                
                segments = []
                cf_durations = []
                seg_start = starts[0]
                seg_start_loc = current_loc

                with open ("tmp-starts", 'w') as tf:
                    for i, start in enumerate(starts):
                        tf.write('%s,%s,%s\n' % (start, dists[i], durs[i]))
                
                for i, start in enumerate(starts):
                    if i == 0 or dists[i - 1] == 0:
                        dur = durs[i]
                        current_loc += dur
                    else:
                        seg = Segment(track, seg_start_loc, seg_start,
                            current_loc - seg_start_loc)
                        c.add_score_segment(seg)
                        segments.append(seg)
                        
                        # track = Track(wav_fn, t["name"])
                        # c.add_track(track)
                        dur = durs[i]
                        cf_durations.append(dur)
                        
                        seg_start_loc = current_loc
                        seg_start = start
                        
                        current_loc += dur
                
                print "cf_durations", cf_durations

                last_seg = Segment(track, seg_start_loc, seg_start,
                    current_loc - seg_start_loc)
                c.add_score_segment(last_seg)
                segments.append(last_seg)
                
                all_segs = []
                
                # no repeated values
                if vx[0] == vx[1]:
                    vx = vx[1:]
                    vy = vy[1:]
                
                for i, seg in enumerate(segments[:-1]):
                    rawseg = c.cross_fade(seg, segments[i + 1], cf_durations[i])
                    all_segs.extend([seg, rawseg])

                all_segs.append(segments[-1])

                first_loc = all_segs[0].score_location
                
                vx[-1] = all_segs[-1].score_location -\
                         first_loc + all_segs[-1].duration
                
                cdf = MonotonicCubicSpline(vx, vy)
                
                for seg in all_segs:
                    vol_frames = N.empty(seg.duration)
                    
                    samplex = N.arange(seg.score_location - first_loc,
                        seg.score_location - first_loc + seg.duration,
                        10000)
                        
                    sampley = N.array([cdf.interpolate(x) for x in samplex])

                    lasty = cdf.interpolate(
                        seg.score_location - first_loc + seg.duration)
                    
                    for i, sy in enumerate(sampley):
                        # print i, sy
                        if i != len(samplex) - 1:
                            vol_frames[i * 10000:(i + 1) * 10000] =\
                                 N.linspace(sy, sampley[i + 1], num=10000)
                        else:
                            vol_frames[i * 10000:] =\
                                N.linspace(sy, lasty,
                                           num=seg.duration - i * 10000)

                    vol = RawVolume(seg, vol_frames)
                    c.add_dynamic(vol)

            
            elif t["waveformClass"] == "waveform":
                score_start = t["scoreStart"]
                track_start = t["wfStart"]
                duration = t["duration"]
                filename = APP_PATH + "static/" + t["filename"]
                
                wav_fn = filename
                
                if filename.lower().endswith('.mp3'):
                    wav_fn = ".".join(filename.split('.')[:-1]) + ".wav"
                    if not os.path.isfile(wav_fn):
                        subprocess.call('lame --decode "%s"'
                            % filename, shell=True)

                    
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

        subprocess.call('rm ' + APP_PATH + 'static/tmp/' +
            dat["outfile"] + '.wav', shell=True)
        return jsonify(url='static/tmp/' + dat["outfile"] + '.mp3',
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


@app.route('/changepoints/<song_name>')
def find_change_points(song_name):
    wav_fn = APP_PATH + 'static/uploads/' + song_name + '.wav'
    try:
        cpraw = subprocess.check_output([
            APP_PATH + 'music_changepoints/novelty',
            wav_fn, 'rms'])
        cp = [float(c) for c in cpraw.split('\n') if len(c) > 0]
    except:
        cp = novelty(wav_fn, k=64, nchangepoints=4)
    out = {
        "changepoints": cp
    }
    return jsonify(**out)

@app.route('/underlayRetarget/<song_name>/<float:length>/<float:before>/<float:after>')
def retargeted_underlay(song_name, length, before, after):
    solo_length = 6.0

    wav_fn = APP_PATH + 'static/uploads/' + song_name + '.wav'
    npz_fn = APP_PATH + 'static/uploads/' + song_name + '.npz'

    beat_path = best_changepoint_path(
        wav_fn,
        npz_fn,
        length + solo_length,
        APP_PATH=APP_PATH,
        nchangepoints=4)

    npz = N.load(npz_fn)

    all_beats = npz["markers"]
    avg_duration = npz["avg_duration"]

    first_target = float(beat_path[0]) - before
    last_target = float(beat_path[-1]) + after + solo_length

    first_beat = min(all_beats, key=lambda b: N.abs(b - first_target))
    last_beat = min(all_beats, key=lambda b: N.abs(b - last_target))

    beat_path_start = [str(b) for b in all_beats 
                       if b >= first_beat and b < float(beat_path[0])]
    beat_path_end = [str(b) for b in all_beats
                     if b > float(beat_path[-1]) and b <= last_beat]

    middle = round(avg_duration[0] * len(beat_path), 5)

    try:
        before_dur = round(float(beat_path[0]) - float(beat_path_start[0]), 5)
    except:
        before_dur = 0

    out = {
        "beats": beat_path_start + beat_path + beat_path_end,
        "before": before_dur,
        "middle": length,
        "solo1": round(middle - length, 5),
        "solo2": float(solo_length),
        "after": round(float(beat_path_end[-1]) - float(beat_path[-1]) - solo_length, 5),
        "changepoints": [beat_path[0], beat_path[-1]],
    }

    # quick check! just in case
    while out["before"] > before:
        out["beats"] = out["beats"][1:]
        out["before"] = round(float(beat_path[0]) - float(out["beats"][0]), 5)

    out["total"] = out["before"] + out["solo1"] + out["middle"] +\
        out["solo2"] + out["after"]

    out["total"] = round(out["total"], 5)

    print out

    return jsonify(**out)


@app.route('/uploadSong', methods=['POST', 'GET'])
def upload_song():
    
    upload_path = APP_PATH + 'static/uploads/'
    
    if request.method == 'POST':
        f = request.files['song']
        file_path = f.filename.replace('\\', '/')
        basename = os.path.basename(file_path)
        filename = secure_filename(f.filename)
        full_name = upload_path + filename
        f.save(full_name)

    if request.method == 'GET':
        """
        upload a file from the local file browser --
        in static/musicbrowser/fullmp3s    
        """
        filename = request.args.get('filename')
        sec_fn = secure_filename(filename)
        basename = os.path.basename(sec_fn)
        full_name = os.path.join(upload_path, basename)
        try:
            with open(basename): pass
        except IOError:
            orig_name = os.path.join(
                APP_PATH + 'static/musicbrowser/fullmp3s',
                     os.path.basename(filename))
            print orig_name, full_name
            shutil.copyfile(orig_name, full_name)
        filename = sec_fn

    # get id3 tags
    song = eyed3.load(full_name)
    song_title = song.tag.title
    song_artist = song.tag.artist
    
    wav_name = ".".join(full_name.split('.')[:-1]) + '.wav'

    # convert to wav if necessary
    try:
        with open(wav_name): pass
    except IOError:
        subprocess.call(
            'lame --decode "%s"' % full_name, shell=True)
                
    # wav2json if necessary
    try:
        with open(upload_path + 'wfData/' + filename + '.json'): pass
    except IOError:
        subprocess.call(
            'wav2json -p 2 -s 10000 --channels mid -n -o "%s" "%s"' %
            (upload_path + 'wfData/' + filename + '.json', wav_name),
            shell=True)

    out = {
        "path": "uploads/" + filename,
        "name": basename.split('.')[0],
        "title": song_title,
        "artist": song_artist
    }

    # get length of song upload
    track = Track(wav_name, "track")
    out["dur"] = track.total_frames() / float(track.sr()) * 1000.0

    # get song graph
    mg = MusicGraph(full_name, cache_path=upload_path, verbose=True)        
    out["graph"] = mg.json_graph()
        
    print "Got music graph"

    # delete wav
    #
    # actually, don't delete the wav for now.
    # subprocess.call('rm "%s"' % wav_name, shell=True)

    # read waveform data json
    with open(upload_path + 'wfData/' + filename + '.json', 'r') as wf:
        out["wfData"] = json.load(wf)["mid"]

    return jsonify(**out)


@app.route('/alignment/<name>')
def alignment(name):
    try:
        out = json.load(
            open("%sstatic/%s-breaths.json" % (APP_PATH, name), 'r'))
    except Exception, e:
        print e
        algn = json.load(
            open("%sstatic/%s.json" % (APP_PATH, name), 'r'))["words"]
        print "filename", "%sstatic/%s44.wav" % (APP_PATH, name)
        new_alignment = reauthor_speech.render_pauses(
            "%sstatic/%s44.wav" % (APP_PATH, name), algn)
        out = {"words": new_alignment}
        json.dump(out,
            open('%sstatic/%s-breaths.json' % (APP_PATH, name), 'w'))

    out["speechText"] = '%s-breaths.json' % name
    return jsonify(**out)


from werkzeug.serving import run_simple
from werkzeug.wsgi import DispatcherMiddleware

from music_browser.browser_flask import app as browserapp

application = DispatcherMiddleware(app, {
    '/musicbrowser': browserapp
})

if __name__ == '__main__':

    run_simple('localhost', 5000, application,
               use_reloader=True, use_debugger=True, use_evalex=True)

