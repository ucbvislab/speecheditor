import sys
import os
import json

import numpy as N
import sklearn
from sklearn.svm import NuSVR
from sklearn.grid_search import GridSearchCV
from sklearn.cross_validation import KFold

MEAN = 0    
STD = 1

def normalize(mat):
    global MEAN, STD
    MEAN = N.mean(mat, axis=0)
    STD = N.std(mat, axis=0)
    return (mat - MEAN) / STD


def regress(input_mat_file, result_mat_file):
    with open(input_mat_file, 'r') as f:
        input_mat = N.load(f)
    with open(result_mat_file, 'r') as f:
        result_mat = N.load(f)
    
    # Support Vector Regression (SVR)
    normalized_input_mat = normalize(input_mat)
    # normalized_input_mat = input_mat
        
    tuned_parameters = {
        'kernel': ['rbf'],
        'gamma': [ 1e-1, 1e-2, 1e-3, 1e-4],
        'C': [8, 16, 32, 64, 128],
        'nu': [1, .75, .5, .1]}
    svr = NuSVR()
    clf = GridSearchCV(svr, tuned_parameters, n_jobs=-1)
    
    # valence
    vBest = clf.fit(normalized_input_mat, result_mat[:, 0], cv=10, refit=True)
    vC = vBest.best_estimator_.C
    vNu = vBest.best_estimator_.nu
    vGamma = vBest.best_estimator_.gamma
    
    vReg = NuSVR(kernel='rbf', C=vC, nu=vNu, gamma=vGamma)
    kf = KFold(len(result_mat[:, 0]), 10, indices=False)
    for train, test in kf:
        X_train, X_test, y_train, y_test = normalized_input_mat[train],\
            normalized_input_mat[test],\
            result_mat[:, 0][train], result_mat[:, 0][test]
        vReg.fit(X_train, y_train)
        y_predicted = vReg.predict(X_test)
        error = N.abs(y_test - y_predicted) / 400.
        # print "r^2 score: %f" % sklearn.metrics.r2_score(y_test, y_predicted)
        # print "average percent error within V space: %f" %\
        #     (N.mean(error) * 100)
    
    #arousal
    aBest = clf.fit(normalized_input_mat, result_mat[:, 1], cv=10, refit=True)
    aC = aBest.best_estimator_.C
    aNu = aBest.best_estimator_.nu
    aGamma = aBest.best_estimator_.gamma
    aReg = NuSVR(kernel='rbf', C=aC, nu=aNu, gamma=aGamma)
    for train, test in kf:
        X_train, X_test, y_train, y_test = normalized_input_mat[train],\
            normalized_input_mat[test],\
            result_mat[:, 1][train], result_mat[:, 1][test]
        aReg.fit(X_train, y_train)
        y_predicted = aReg.predict(X_test)
        error = N.abs(y_test - y_predicted) / 400.
        # print "average percent error within A space: %f" %\
        #             (N.mean(error) * 100)
    
    # return vBest, aBest
    v = vReg.fit(normalized_input_mat, result_mat[:, 0])
    a = aReg.fit(normalized_input_mat, result_mat[:, 1])
    return v, a
    
if __name__ == '__main__':
    vReg, aReg = regress(sys.argv[1], sys.argv[2])
    # predict a directory of clips
    json_list = []
    for root, dirs, files in os.walk(sys.argv[3]):
        for f in files:
            filename, extension = os.path.splitext(f)
            if extension == ".mfccs":
                f_mfccs = open(sys.argv[3] + f, 'r').read()
                ceps = (N.array([float(x) for x in f_mfccs.split(',')]) -
                        MEAN) / STD
                v = vReg.predict(ceps)[0]
                a = aReg.predict(ceps)[0]
                out = {"clip": '.'.join(filename.split('.')[:-1]) + '.mp3',
                       "valence": v,
                       "arousal": a}
                json_list.append(out)

    print json.dumps(json_list)

