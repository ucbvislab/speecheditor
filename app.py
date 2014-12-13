try:
    import simplejson as json
except:
    import json
import urllib
import subprocess
import os
import glob
from mutagen.id3 import ID3
import shutil

import sys
sys.path.append("/home/ubuntu/speecheditor")
sys.path.append("/var/www/html/srubin/speecheditor")

import numpy as N
import click

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

    return render_template(
        'index.html',
        music_browser=app.config["MUSIC_BROWSER"],
        speechtracks=app.config["SPEECH_TRACKS"])

@app.route('/reauthor', methods=['POST'])
def reauthor():
    if request.method == 'POST':
        post_data = urllib.unquote(request.data)
        dat = json.loads(post_data)
        
        tracks = dat["exportedTimeline"]
        result = {}
        
        comp = Composition(channels=1)

        print "Start: comp segments", len(comp.segments)

        speech_is_done = False

        json.dump(dat["usageData"],
            open(APP_PATH + "static/tmp/" + dat["outfile"] + '-usage.json', 'w'),
            indent=4)

        for t in tracks:
            if t["waveformClass"] == "textAlignedWaveform":
                
                # TODO: Fix this hack! This is to ensure that we only generate
                #       the speech track once. We need to do this because we're
                #       sending the speech twice, once with each interview
                #       track waveform.
                if speech_is_done: 
                    continue
                speech_is_done = True

                score_start = t["scoreStart"]
                with open(APP_PATH + 'static/speechtracks/' + dat["speechText"], 'r') as f:
                    af = json.loads(f.read())["words"]
                ef = dat["speechReauthor"]["words"]

                json.dump(dat["speechReauthor"],
                    open(APP_PATH + "static/tmp/" + dat["outfile"] + '.json', 'w'),
                    indent=4)

                # crossfades = True
                # if "crossfades" in dat:
                #     crossfades = dat["crossfades"]

                args = {
                    "cut_to_zc": True,
                    "samplerate": dat["speechSampleRate"],
                    "tracks_and_segments": True,
                    "score_start": score_start,
                    "crossfades": True,
                    "render_from_all_tracks": False
                }

                speech_audio_path = APP_PATH + 'static/speechtracks/' + dat["speechAudio"]

                if os.path.splitext(speech_audio_path)[-1] == ".mp3":
                    wav_speech_audio_path = os.path.splitext(speech_audio_path)[0] + ".wav"

                    if os.path.exists(wav_speech_audio_path):
                        speech_audio_path = wav_speech_audio_path


                print "# Rebuilding speech"
                result = reauthor_speech.rebuild_audio(
                    speech_audio_path, af, ef, **args)
                print "# Done rebuilding speech"
                
                comp.add_tracks(result["tracks"])
                comp.add_segments(result["segments"])
            
            elif t["waveformClass"] == "musicWaveform":
                # handle music authored per beat
                starts = t["extra"]["starts"]
                durs = t["extra"]["durations"]
                dists = t["extra"]["distances"]

                if "globalVolume" in t:
                    global_vol = t["globalVolume"]
                else:
                    global_vol = 1.0

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
                comp.add_track(track)
                current_loc = float(score_start)
                
                # create the spline interpolator
                vx = vx / 1000.0 * track.samplerate
                # cdf = MonotonicCubicSpline(vx, vy)
                
                
                segments = []
                cf_durations = []
                seg_start = starts[0]
                seg_start_loc = current_loc

                # with open ("tmp-starts", 'w') as tf:
                #     for i, start in enumerate(starts):
                #         tf.write('%s,%s,%s\n' % (start, dists[i], durs[i]))
                
                for i, start in enumerate(starts):
                    if i == 0 or dists[i - 1] == 0:
                        dur = durs[i]
                        current_loc += dur
                    else:
                        seg = Segment(track, seg_start_loc, seg_start,
                            current_loc - seg_start_loc)
                        comp.add_segment(seg)
                        segments.append(seg)
                        
                        # track = Track(wav_fn, t["name"])
                        # comp.add_track(track)
                        dur = durs[i]
                        cf_durations.append(dur)
                        
                        seg_start_loc = current_loc
                        seg_start = start
                        
                        current_loc += dur
                
                print "cf_durations", cf_durations

                last_seg = Segment(track, seg_start_loc, seg_start,
                    current_loc - seg_start_loc)
                comp.add_segment(last_seg)
                segments.append(last_seg)
                
                all_segs = []
                
                # no repeated values
                if vx[0] == vx[1]:
                    vx = vx[1:]
                    vy = vy[1:]
                
                for i, seg in enumerate(segments[:-1]):
                    rawseg = comp.cross_fade(seg, segments[i + 1], cf_durations[i])
                    all_segs.extend([seg, rawseg])

                all_segs.append(segments[-1])

                first_loc = all_segs[0].comp_location
                
                vx[-1] = all_segs[-1].comp_location -\
                         first_loc + all_segs[-1].duration
                
                cdf = MonotonicCubicSpline(vx, vy)
                
                for seg in all_segs:
                    vol_frames = N.empty(seg.duration)
                    
                    samplex = N.arange(seg.comp_location - first_loc,
                        seg.comp_location - first_loc + seg.duration,
                        10000)
                        
                    sampley = N.array([cdf.interpolate(x) for x in samplex])

                    lasty = cdf.interpolate(
                        seg.comp_location - first_loc + seg.duration)
                    
                    for i, sy in enumerate(sampley):
                        # print i, sy
                        if i != len(samplex) - 1:
                            vol_frames[i * 10000:(i + 1) * 10000] =\
                                 N.linspace(sy, sampley[i + 1], num=10000)
                        else:
                            vol_frames[i * 10000:] =\
                                N.linspace(sy, lasty,
                                           num=seg.duration - i * 10000)

                    vol_frames *= global_vol

                    vol = RawVolume(seg, vol_frames)
                    comp.add_dynamic(vol)

            
            elif t["waveformClass"] == "waveform":
                score_start = t["scoreStart"]
                track_start = t["wfStart"]
                duration = t["duration"]
                filename = APP_PATH + "static/speechtracks/" + t["filename"]
                
                wav_fn = filename
                
                if filename.lower().endswith('.mp3'):
                    wav_fn = ".".join(filename.split('.')[:-1]) + ".wav"
                    if not os.path.isfile(wav_fn):
                        subprocess.call('lame --decode "%s"'
                            % filename, shell=True)

                    
                track = Track(wav_fn, t["name"])
                seg = Segment(track, score_start, track_start, duration)
                
                comp.add_track(track)
                comp.add_segment(seg)
        
        print "\n\n### SEGMENT COUNT", len(comp.segments), "\n\n"

        comp.export(
            adjust_dynamics=False,
            filename=APP_PATH + "static/tmp/" + dat["outfile"],
            channels=1,
            filetype='wav',
            samplerate=result["samplerate"],
            separate_tracks=False)
        
        subprocess.call('rm ' + APP_PATH + 'static/tmp/' +
            dat["outfile"] + '.mp3', shell=True)

        subprocess.call('lame --quiet -q 5 ' + APP_PATH + 'static/tmp/'
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
        with open(APP_PATH + 'static/speechtracks/' + dat["speechText"], 'r') as f:
            af = json.load(f)["words"]

        return Response(json.dumps(duplicate_lines.get_dupes(af)),
            mimetype="application/json")
    return


@app.route('/changepoints/<song_name>')
def find_change_points(song_name):
    song_name = secure_filename(urllib.unquote(song_name))
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

    song_name = secure_filename(urllib.unquote(song_name))

    wav_fn = APP_PATH + 'static/uploads/' + song_name + '.wav'
    npz_fn = APP_PATH + 'static/uploads/' + song_name + '.npz'

    beat_path, best_cost, cps, durs = best_changepoint_path(
        wav_fn,
        npz_fn,
        length + solo_length,
        APP_PATH=APP_PATH,
        nchangepoints=4)

    print "changepoints", cps

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


    # I think these word as they're supposed to, but I'm not 100% sure
    cp1_delta = round(float(beat_path[0]) - float(cps[0]), 5)
    cp2_delta = round(float(beat_path[-1]) - float(cps[1]), 5)

    between_dur = N.sum(durs) + cp1_delta + cp2_delta

    print "deltas", cp1_delta, cp2_delta

    # try:
    #     # before_dur = round(float(beat_path[0]) - float(beat_path_start[0]), 5)
    #     before_dur = round(float(cps[0]) - float(beat_path_start[0]), 5) 
    # except:
    #     before_dur = 0

    # out = {
    #     "beats": beat_path_start + beat_path + beat_path_end,
    #     "before": before_dur,
    #     "middle": round(length, 5),
    #     "solo1": round(middle - (length + cp1_delta), 5),
    #     "solo2": float(solo_length + cp2_delta),
    #     "after": round(float(beat_path_end[-1]) - float(beat_path[-1]) - solo_length, 5),
    #     "changepoints": cps
    #     #"changepoints": [beat_path[0], beat_path[-1]],
    # }

    try:
        # before_dur = round(float(beat_path[0]) - float(beat_path_start[0]), 5)
        before_dur = round(float(cps[0]) - float(beat_path_start[0]), 5) 
    except:
        before_dur = 0

    out = {
        "beats": beat_path_start + beat_path + beat_path_end,
        "before": before_dur,
        "solo1": round(between_dur - length - .5, 5),
        "middle": round(length, 5),
        "solo2": solo_length,
        "after": round(float(beat_path_end[-1]) - float(cps[1]) - solo_length, 5),
        "changepoints": cps,
    }

    # quick check! just in case
    while out["before"] > before:
        print out["beats"]
        out["beats"] = out["beats"][1:]
        # out["before"] = round(float(beat_path[0]) - float(out["beats"][0]), 5)
        out["before"] = round(float(cps[0]) - float(out["beats"][0]), 5)

    out["total"] = out["before"] + out["solo1"] + out["middle"] +\
        out["solo2"] + out["after"]

    out["total"] = round(out["total"], 5)

    print out

    print "\n\n### Target:", (length + solo_length) / avg_duration
    print "### Cost:", best_cost

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
    try:

        song = ID3(full_name)
        song_title = song["TIT2"].text[0]
        song_artist = song["TPE1"].text[0]
    except:
        song_title = os.path.basename(full_name)
        song_artist = "Unknown"

    
    wav_name = ".".join(full_name.split('.')[:-1]) + '.wav'

    # convert to wav if necessary
    try:
        with open(wav_name): pass
    except IOError:
        subprocess.call(
            'lame --decode "%s"' % full_name, shell=True)
                
    # wav2json if necessary
    print "wav2json if necessary"
    try:
        with open(upload_path + 'wfData/' + filename + '.json'): pass
    except IOError:
        cmd = 'wav2json -p 2 -s 10000 --channels mid -n -o "%s" "%s"' %\
            (upload_path + 'wfData/' + filename + '.json', wav_name)
        print cmd
        subprocess.call(cmd, shell=True)

    out = {
        "path": "uploads/" + filename,
        "name": basename.split('.')[0],
        "title": song_title,
        "artist": song_artist,
        "basename": os.path.splitext(filename)[0]
    }

    # get length of song upload
    track = Track(wav_name, "track")
    out["dur"] = track.duration / float(track.samplerate) * 1000.0

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
    breath_fn = "%s-breaths.json" % name
    breath_full_path = "{}static/speechtracks/{}-breaths.json".format(APP_PATH, name)

    nobreath_fn = name + ".json"
    nobreath_full_path = "{}static/speechtracks/{}.json".format(APP_PATH, name)

    if os.path.isfile(breath_full_path):
        out = json.load(open(breath_full_path, 'r'))
        out["speechText"] = breath_fn
    else:
        out = json.load(open(nobreath_full_path, 'r'))
        out["speechText"] = nobreath_fn

    return jsonify(**out)


from werkzeug.serving import run_simple
from werkzeug.wsgi import DispatcherMiddleware


@click.command()
@click.option('--music-browser/--no-browser', default=False,
              help='do not load the music browser app')
def run_app(music_browser):
    if music_browser:
        # Figure out how to do these searches without requiring MySQL

        # from music_browser.browser_flask import app as browserapp
        # application = DispatcherMiddleware(app, {
        #     '/musicbrowser': browserapp
        # })

        app.config["MUSIC_BROWSER"] = True
        application = app

    else:
        app.config["MUSIC_BROWSER"] = False
        application = app

    app.config["SPEECH_TRACKS"] = set()
    for fn in glob.glob(APP_PATH + 'static/speechtracks/*.json'):
        name = os.path.splitext(os.path.basename(fn))[0]
        if name.endswith("-breaths"):
            name = name.split('-breaths')[0]
        app.config["SPEECH_TRACKS"].add(name)

    run_simple('0.0.0.0', 5000, application,
               use_reloader=True, use_debugger=True, use_evalex=True)


if __name__ == '__main__':
    run_app()


