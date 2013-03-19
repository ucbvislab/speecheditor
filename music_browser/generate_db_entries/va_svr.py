# support vector regression for valence/arousal of music
# using techniques from
# using the CAL500 dataset

# other idea: try to classify region and see how that works
# use a more rigorous procedure for assigning quadrants from CAL 500

import csv
import re
from pprint import pprint

import numpy as N
from scikits.learn.svm import NuSVR
from scikits.learn.cross_val import KFold
from scikits.learn.grid_search import GridSearchCV
import echonest.audio as audio

from frontend import *
from frontend import Pipeline

# create key profile matrix
# see: http://www.scar.utoronto.ca/~marksch/psyc56/Krumhansl%201990%20Ch%204.pdf
# code: http://visualcomputing.yonsei.ac.kr/CWiK/lab/lab4/lab4_2.m
Cmaj_key_prof = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
Cmin_key_prof = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
maj_prof = N.zeros((12, 12))
min_prof = N.zeros((12, 12))
for i in range(12):
    maj_prof[:,i] = N.roll(Cmaj_key_prof, i)
    min_prof[:,i] = N.roll(Cmin_key_prof, i)
key_prof = N.zeros((12, 24))
key_prof[:,:12] = maj_prof
key_prof[:,12:] = min_prof


def song_key(src):
    C = Chroma(44100, 4410)
    pipe = Pipeline(src, Mono(), C)
    c_feats = pipe.toarray()
    total_chroma = N.mean(c_feats, axis=0)
    tonality = N.dot(total_chroma, key_prof)
    key = N.argmax(tonality)
    return key

def average_energy(src):
    pipe = Pipeline(src, Mono())
    frames = pipe.toarray()
    avg = N.mean(frames ** 2)
    return avg, N.sqrt(N.mean((avg - frames) ** 2))

def bpm(filename):
    audiofile = audio.LocalAudioFile(filename)
    beats = audiofile.analysis.beats
    tempo = audiofile.analysis.tempo["value"]
    tempo_sd = N.std([b.duration for b in beats])
    return tempo, tempo_sd
    
def harmonics(src):
    pipe = Pipeline(src, Mono(), STFT(4410), Abs())
    frames = pipe.toarray()
    nfreq = 2205
    HS = N.zeros(nfreq - 1)
    sd_HS = N.zeros(nfreq - 1)
    for f in range(1, nfreq):
        # M = 22050 / (f * (22050 / 2205))
        M = 2205 / f
        HS_current = N.zeros(len(frames))
        print f
        for k in range(1, M + 1):
            for t, frame in enumerate(frames):
                try:
                    HS_current[t] += \
                        N.min((frame[f], frame[k * f]))
                except:
                    import pdb; pdb.set_trace()
                    
        HS[f] = N.mean(HS_current)
        sd_HS[f] = N.std(HS_current)
        
    import pdb; pdb.set_trace()
    return HS, sd_HS

filename = "tal-music/the28/Cubes.wav"
src = AudioSource(filename)

key = song_key(src)
energy, sd_energy = average_energy(src)
bpm, sd_bpm = bpm(filename)
harmonics(src)


import pdb; pdb.set_trace()


v_plus = 1.0/3.0
v_minus = -1.0/3.0
a_plus = .5
a_minus = -0.5

va = {
    "top": N.mean((a_plus, 1)),
    "middle": N.mean((a_plus, a_minus)),
    "middle_top": N.mean((a_plus, 0)),
    "middle_bottom": N.mean((a_minus, 0)),
    "bottom": N.mean((a_minus, -1)),
    "left": N.mean((v_minus, -1)),
    "center": N.mean((v_minus, v_plus)),
    "right": N.mean((v_plus, 1))
}

va_map = {
    "Calming_/_Soothing": (6, (va["center"], va["top"])),
    "Angry_/_Agressive": (0, (va["left"], va["top"])),
    "Exciting_/_Thrilling": (14, (va["center"], va["top"])),
    "Happy": (16, (va["right"], va["top"])),
    "Pleasant_/_Comfortable": (24, (va["right"], va["middle_top"])),
    "Laid-back_/_Mellow": (18, (va["right"], va["middle_bottom"])),
    "NOTLaid-back_/_Mellow": (19, (va["left"], va["middle_top"])),
    "Sad": (30, (va["left"], va["bottom"])),
    "NOTExciting_/_Thrilling": (15, (va["center"], va["bottom"])),
    "NOTAngry_/_Agressive": (1, (va["right"], va["bottom"])),
    "NOTArousing_/_Awakening": (3, (va["left"], va["middle_bottom"]))
}

cat_pts = {}
for cat in va_map:
    cat_pts[va_map[cat][0]] = va_map[cat][1]

def process_annotations(filename):
    cat_idx = [va_map[x][0] for x in va_map]
    songs = []
    song_pts_cart = []
    song_pts_polar = []
    with open(filename, 'r') as f:
        reader = csv.reader(f)
        song_idx = 0
        for line in reader:
            cats = [i for i, x in enumerate(line)
                    if x != '0' and i in cat_idx]
            if len(cats) > 1:
                import pdb; pdb.set_trace()
                
                v_coord = N.average([cat_pts[i][0] for i in cats],
                                     weights=[line[i] for i in cats])
                a_coord = N.average([cat_pts[i][1] for i in cats],
                                     weights=[line[i] for i in cats])
                distance = N.sqrt(v_coord * v_coord + a_coord * a_coord)
                angle = N.arctan2(a_coord, v_coord)
                songs.append(song_idx)
                song_pts_cart.append((v_coord, a_coord))
                song_pts_polar.append((angle, distance))
            song_idx += 1
        from matplotlib import pyplot as plt
        # plt.scatter([x[0] for x in song_pts_cart], [x[1] for x in song_pts_cart])
        # plt.show()
    
    song_titles = []
    with open("CAL500/songNames.txt", 'r') as f:
        line_num = 0
        for line in f:
            if line_num in songs:
                song_titles.append(line[:-1])
            line_num += 1
    
    # for training
    features = N.zeros((len(songs) - 2, 124))
    target_angles = N.zeros(len(songs) - 2)
    target_distances = N.zeros(len(songs) - 2)
    t_idx = 0
    
    wav_re = re.compile(r'wav/(.*)\.wav')
    seen_titles = []
    with open("CAL500/features.arff", 'r') as f:
        data_flag = 0
        idx = None
        for line in f:
            if data_flag == 2:
                data_flag = 1
            elif data_flag == 1:
                try:
                    features[t_idx] = [float(x) for x in line.split(',')]
                except:
                    import pdb; pdb.set_trace()
                    
                target_angles[t_idx] = song_pts_polar[idx][0]
                target_distances[t_idx] = song_pts_polar[idx][1]
                data_flag = 0
                t_idx += 1
            else:
                m = wav_re.search(line)
                if m:
                    title = m.group(1)
                    try:
                        if title not in seen_titles:
                            seen_titles.append(title)
                            idx = song_titles.index(title)
                            data_flag = 2
                    except:
                        pass

    kf = KFold(len(target_angles), 10, indices=False)

    # tuned_parameters = {'kernel': ['linear', 'rbf'],
    #                      'gamma': [ 1e-2, 1e-3, 1e-4, 1e-5],
    #                      'C': [16, 32, 64, 128],
    #                      'nu': [1e-2, 1e-3, 1e-4, 1e-5]}
    
    tuned_parameters = {'kernel': ['rbf'],
                         'gamma': [ 1e-1, 1e-2, 1e-3, 1e-4],
                         'C': [2, 4, 8, 16, 32, 64],
                         'nu': [1, 1e-1, 1e-2, 1e-3, 1e-4]}
    
    svr = NuSVR()
    
    # for score_name, score_func in scores:
    clf = GridSearchCV(svr, tuned_parameters, n_jobs=4)
    best = clf.fit(features, target_angles)
    # clf.fit(features[train], target_angles[train], 
    #         cv=KFold(len(target_angles), 10, indices=False))
    import pdb; pdb.set_trace()
    
    # X_test = features[test]
    # y_test = target_angles[test]
    # print "Tuned for '%s' with optimal value: %0.3f" % (
    #     score_name, score_func(X_test, y_test))
    # print "Grid scores:"
    # pprint(clf.grid_scores_)
    # print
    
    
    C = best.best_estimator.C
    nu = best.best_estimator.nu
    gamma = best.best_estimator.gamma
    
    r_angle = NuSVR(kernel='rbf', C=C, nu=nu, gamma=gamma)
    # r_angle = NuSVR(C=N.power(2,6), nu=N.power(2,-8), gamma=N.power(2,-4))
    # r_dist = NuSVR(C=N.power(2,8), nu=N.power(2,-8), gamma=N.power(2,-10))
    
    a_scores = []
    d_scores = []
    for train, test in kf:
        X_train, X_test, y_train, y_test = features[train], features[test],\
            target_angles[train], target_angles[test]
        # ydist_train, ydist_test = target_distances[train],\
        #     target_distances[test]
    
        # r_dist.fit(X_train, ydist_train)
        r_angle.fit(X_train, y_train)
        y_predicted = r_angle.predict(X_test)
        a_score = r_angle.score(X_test, y_test)
        # d_score = r_dist.score(X_test, ydist_test)
        a_scores.append(a_score)
        # d_scores.append(d_score)

    import pdb; pdb.set_trace()
    

if __name__ == '__main__':
    process_annotations("CAL500/softAnnotations.txt")
            
