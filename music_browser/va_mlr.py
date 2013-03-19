import sys
import os
import json
import re
from time import sleep

from progressbar import *
import numpy as N
from sklearn import linear_model
from sklearn.cross_validation import KFold
from sklearn.svm import NuSVR
from sklearn.grid_search import GridSearchCV
from scipy.io import loadmat
from generate_db_entries.frontend import *
from generate_db_entries.frontend import Pipeline
import spotimeta
import MySQLdb

from generate_db_entries.process_clip_mfccs import *
import songs_db

def s2m(seconds):
    minutes = int(seconds / 60)
    seconds = seconds - 60 * minutes
    ms = seconds - int(seconds)
    return "%d:%02d" % (minutes, seconds)

TRAIN = False

# Coefficients and intercept trained from the entire MoodSwings corpus
coef = N.array([[  0.19559232,  -2.2384261 ,   0.05024586, -14.15875911,
         -5.74563906,   2.05164677,   1.99727057,   7.84433002,
          7.22431571,   2.1826282 , -14.3642598 ,  -8.72785079,
          9.73691069, -12.83262723,   6.26785322,  -4.55740902,
        -18.46541758,  -9.44062321,   6.81369636,  -7.63603386],
       [  2.36078033, -10.71850151,  -0.13278986,  -4.0759491 ,
          0.25733318,  -1.50505885,  -3.01845438,  -7.4305258 ,
        -17.30107532,   5.85420971,  10.19763612,   9.26594938,
        -21.44146272,   3.86723894,  -4.76741946,  -1.84548569,
         -1.15210137,   5.28977297,   0.07236828,   7.40492366]])
intercept = N.array([  19.20195638, -159.37552426])

def predict(x):
    return N.sum(N.multiply(x, coef), axis=1) + intercept

if TRAIN:
    # progress bar stuff
    widgets = ['Loading: ', Percentage(), ' ',
               Bar(marker='=', left='[', right=']'), ETA()]
    pbar = ProgressBar(widgets=widgets, maxval=100)

    # Goal: classify in 15 second chunks

    ms_data = loadmat('moodswingsturk/msLiteTurk.mat')["msLiteTurk"]
    song_ids = [x[0][0] for x in ms_data["songid"][0][0][0]]

    time = {}
    valence = {}
    arousal = {}
    contrast = {}
    
    artist = {}
    orig_song_name = {}
    song_name = {}
    hrefs = {}

    single_valence = {}
    single_arousal = {}

    feature_type = "ceps"
    coords = "rect"

    def rm_short_words(word):
        return ' '.join([x for x in word.split(' ')
                         if len(x) > 2])

    v_stds = []
    a_stds = []

    pbar.start()
    for i, sid in enumerate(song_ids):
        time[sid] = [x[0] for x in ms_data["time"][0][0][0][i]]
        valence[sid] = [x[0] for x in ms_data["valence"][0][0][0][i]]
        arousal[sid] = [x[0] for x in ms_data["arousal"][0][0][0][i]]
        # zero crossings
        # v_changes = len(N.where(N.diff(N.sign(valence[sid])))[0])
        # a_changes = len(N.where(N.diff(N.sign(arousal[sid])))[0])
        v_by_user = N.reshape(valence[sid], (-1,15))
        a_by_user = N.reshape(arousal[sid], (-1,15))
        v_stds.append(N.std(N.mean(v_by_user, axis=1)))
        a_stds.append(N.std(N.mean(a_by_user, axis=1)))
        
        single_valence[sid] = N.mean(valence[sid])
        single_arousal[sid] = N.mean(arousal[sid])

        artist[sid] = ms_data["artist"][0][0][0][i][0]
        orig_song_name[sid] = ms_data["song"][0][0][0][i][0].split('-', 1)[1]
        artist[sid] = artist[sid].replace('_', ' ')
        song_name[sid] = rm_short_words(orig_song_name[sid].replace('_', ' '))
        
        tmp_dat = loadmat('moodswingsturk/msLiteFeatures/' +
                          str(sid) + '.mat')
        contrast_features = tmp_dat["features"][feature_type][0][0]
    
        min_time = N.min(time[sid])
        max_time = N.max(time[sid])
        search = spotimeta.search_track(artist[sid] + ' ' + song_name[sid])
        sleep(.2)
        if search["total_results"] > 0:
            hrefs[sid] = search["result"][0]["href"]
            hrefs[sid] += '#%s' % s2m(min_time)
        
        if feature_type == "chroma":
            hop = 2048. / 22050
        else:
            hop = 256. / 22050.  # seconds per hop
        start_window = int(min_time / hop)
        end_window = int(max_time / hop)
        contrast_limited = contrast_features[:, start_window:end_window]
        contrast[sid] = N.mean(contrast_limited, axis=1)
        pbar.update(100 * float(i) / len(song_ids))
    pbar.finish()
    print
    
    print "Average valence SD: %f" % N.mean(v_stds)
    print "Average arousal SD: %f" % N.mean(a_stds)
   
    valence_vec = N.asarray([single_valence[sid] for sid in song_ids])
    arousal_vec = N.asarray([single_arousal[sid] for sid in song_ids])
    contrast_mat = N.vstack([contrast[sid] for sid in song_ids])
    response_mat = N.vstack((valence_vec, arousal_vec)).T

    distance_vec = N.sqrt(arousal_vec ** 2 + valence_vec ** 2)
    angle_vec = N.arctan2(arousal_vec, valence_vec)
    polar_response_mat = N.vstack((distance_vec, angle_vec)).T

    # lrscore = LR.score(contrast_mat, response_mat[:,0])
    # print "valence R^2 score: " + str(lrscore)
    # lrscore = LR.score(contrast_mat, response_mat[:,1])
    # print "arousal R^2 score: " + str(lrscore)

    kf = KFold(len(response_mat), 50, indices=False)
    dists = []
    for train, test in kf:
        if coords == "polar":
            response_train = polar_response_mat[train]
            response_test = polar_response_mat[test]
        else:
            response_train = response_mat[train]
            response_test = response_mat[test]
        
        LR = linear_model.LinearRegression()
        lrfit = LR.fit(contrast_mat[train], response_train)
        result = lrfit.predict(contrast_mat[test])
        if coords != "polar":
            for i, res in enumerate(result):
                dists.append(N.linalg.norm(res - response_test[i])
                             / N.sqrt(320000))
            print ("Residual sum of squares for valence: %.2f" %
                    N.mean((result[:,0] - response_test[:,0]) ** 2))
            print ("Residual sum of squares for arousal: %.2f" %
                    N.mean((result[:,1] - response_test[:,1]) ** 2))
        else:
            for i, res in enumerate(result):
                distance = N.sqrt(res[0] ** 2 + response_test[i][0] ** 2 -\
                                  2 * res[0] * response_test[i][0] *\
                                  N.cos(res[1] - response_test[i][1]))
                dists.append(distance)
    mean_dist = N.mean(dists)
    print "mean dist " + str(mean_dist)
    

    LR = linear_model.LinearRegression()
    LR.fit(contrast_mat, response_mat)


# kyoto = N.mean(process_clip_mfccs("tal-music/clips/kyoto15s.wav"), axis=0)

# test = open('tal-music/clips/sweetpotato.mfccs', 'r').read()
# test = [float(x) for x in test.split(',')]
    

if __name__ == '__main__':
    # predict one clip
    if len(sys.argv) == 2:
        file_mfccs = open(sys.argv[1] + '.mfccs', 'r').read()
        va = predict([float(x) for x in file_mfccs.split(',')])
        print "Valence: %4f" % va[0]
        print "Arousal: %4f" % va[1] 
    # predict a directory of clips
    elif len(sys.argv) == 3:
        if sys.argv[1] == 'dir':
            json_list = []
            for root, dirs, files in os.walk(sys.argv[2]):
                for f in files:
                    filename, extension = os.path.splitext(f)
                    if extension == ".mfccs":
                        file_mfccs = open(sys.argv[2] + f, 'r').read()
                        va = predict(
                            [float(x) for x in file_mfccs.split(',')])
                        out = {"clip": filename,
                               "valence": va[0],
                               "arousal": va[1]}
                        json_list.append(out)
                        
                        new_fn = " ".join(filename.split('-')[:2])
                        song_id = songs_db.filename_resolver(new_fn)
                        if song_id:
                            con = MySQLdb.connect('localhost', 'srubin_mbrowse', 'qual-cipe-whak', 'srubin_musicbrowser')
                            cur = con.cursor(MySQLdb.cursors.DictCursor)
                            cur.execute("INSERT INTO mlr_va(song_id, valence, arousal) VALUES(%s,%s,%s)",
                                        (song_id, va[0], va[1]))
                            con.commit()
                        else:
                            print "Could not resolve ", filename
            # print json.dumps(json_list)
    # output the ground truth json data
    elif len(sys.argv) == 1:
        json_list = []
        for k in hrefs:
            va = predict(contrast[k])
            out = {"href": hrefs[k],
                   "valence": single_valence[k],
                   "arousal": single_arousal[k],
                   "name": artist[k] + ' ' + orig_song_name[k],
                   "valence_predicted": va[0],
                   "arousal_predicted": va[1]}
            json_list.append(out)
        print json.dumps(json_list)
        

# get 15 second chunks of features from songs
# start with Spectral Contrast features

# average them over that window

# find the average valence and average arousal over that window too

# do multiple linear regression