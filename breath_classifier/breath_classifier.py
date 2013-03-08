import pickle
import sys
import os

print >> sys.stderr, "system stuff"

import numpy as N
from sklearn import svm
print >> sys.stderr, "svc"
from numpy.random import permutation
from sklearn.cross_validation import StratifiedKFold
from sklearn.grid_search import GridSearchCV
from scipy.signal import lfilter

sys.path.append(os.path.join('/Users/srubin/code/'))
from frontend import *
from frontend import Pipeline

from radiotool import composer as C
import all_features

print >> sys.stderr, "Succeeded in all the imports in breath_classifier"

def svm_grid_search(features, labels, samples="all", feat=39):
    if samples == "all":
        idx = range(len(labels))
    else:
        idx = permutation(N.shape(features)[0])[:samples]
    C_range = 10.0 ** N.arange(-3, 4)
    gamma_range = 10.0 ** N.arange(-4, 3)
    param_grid = dict(gamma=gamma_range, C=C_range)
    cv = StratifiedKFold(labels[idx], 3)
    grid = GridSearchCV(svm.SVC(kernel='rbf', probability=True),
        param_grid=param_grid, cv=cv)
    grid.fit(features[:, :feat][idx], labels[idx])
    return grid


def train_svm():
    features, labels = all_features.features_and_labels(train=True)
    feature_stds = N.std(features, axis=0)
    feature_means = N.mean(features, axis=0)
    features = (features - feature_means) / feature_stds
    clf = svm_grid_search(features, labels, feat=39)
    return clf.best_estimator_, feature_means, feature_stds


def store_svm():
    clf, mu, sigma = train_svm()
    out = {"clf": clf,
           "mu": mu,
           "sigma": sigma}
    cwd = os.getcwd()
    os.chdir(os.path.dirname(os.path.realpath(__file__)))
    pickle.dump(out, open('pickled/svm', 'w'))
    os.chdir(cwd)
    return out


def get_mfcc(filename):
    audio = C.Track(filename, 'woop')
    resample_factor = 11025.0 / audio.samplerate()
    src = AudioSource(filename)
    pipe = Pipeline(
        src,
        Resample(resample_factor),
        MFCC(11025, 441, nhop=441, nmel=40, ndct=13, fmin=133.3333))
    return pipe.toarray()


def deltas(x, window_size=9):
    # define window shape
    h_len = int(window_size / 2)
    w = 2 * h_len + 1
    win = N.arange(h_len, - h_len, -1)

    # pad data by repeating first and last columns
    shape = N.shape(x)
    xx = N.zeros((shape[0] + 2 * h_len, shape[1]))
    xx[h_len: - h_len, :] = x
    xx[:h_len, :] = N.tile(x[0, :], (h_len, 1))
    xx[ - h_len:, :] = N.tile(x[-1, :], (h_len, 1))

    # apply the delta filter
    d = lfilter(win, 1, xx, zi=None, axis=0)

    # trim edges
    d = d[h_len: - h_len, :]
    return d


def get_features(audio_file):
    print "Getting features of", audio_file
    cc = get_mfcc(audio_file)
    audio = C.Track(audio_file, 'woop')
    n_frames = audio.total_frames()
    length = n_frames / float(audio.sr())
    n_subframes = N.shape(cc)[0]
    features = N.hstack((cc, deltas(cc, 5), deltas(deltas(cc, 5), 5)))
    return features


def classify(audio_file):
    try:
        cwd = os.getcwd()
        os.chdir(os.path.dirname(os.path.realpath(__file__)))
        svm = pickle.load(open('pickled/svm', 'r'))
        print "Retrieved pickled svm classifier"
        os.chdir(cwd)
    except Exception, e:
        print "Could not find pickled svm classifier:", e
        svm = store_svm()
    features = get_features(audio_file)
    features = (features - svm["mu"]) / svm["sigma"]
    pred = svm["clf"].predict_proba(features)

    # median filter on the resulting classification
    mf_pred = N.zeros(pred.shape[0])
    f_size = 5
    for i, x in enumerate(pred):
        if i - f_size / 2 >= 0 and i + f_size / 2 < len(pred):
            mf_pred[i] = N.median(
                [x[1] for x in pred[i - f_size / 2:i + f_size / 2 + 1]])
    pred = (mf_pred > .5).astype(N.int8)

    best_breath = N.argmax(mf_pred)
    if mf_pred[best_breath] <= .5:
        best_breath = -1

    start = 0
    labels = ['sp', '{BR}']
    words = ['{pause}', '{breath}']
    results = []
    for i in range(1, len(pred)):
        if pred[i] != pred[i - 1] or i == len(pred) - 1:
            lab_idx = pred[i - 1]
            if i == len(pred) - 1:
                lab_idx = pred[i]
            results.append({"start": start * 441. / 11025.,
                            "end": i * 441. / 11025.,
                            "alignedWord": labels[lab_idx],
                            "word": words[lab_idx]})
            if best_breath < i and best_breath >= start:
                results[-1]["breathProb"] = mf_pred[best_breath]
                results[-1]["breathLen"] = i - start
            start = i
    return results
