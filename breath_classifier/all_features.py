import numpy as N
import glob
import os

def features_and_labels(train=False, test=False):
    cwd = os.getcwd()
    os.chdir(os.path.dirname(os.path.realpath(__file__)))
    
    features = []
    labels = []
    if train:
        for f in glob.glob('processed_features/scorerickard-pauses.csv'):
            label_fn = 'processed_labels/' + f.split('/')[-1]
            features.append(N.loadtxt(f, delimiter=','))
            labels.append(N.loadtxt(label_fn, delimiter=','))
            
    if test:
        for f in glob.glob('processed_features/sedaris-pauses.csv'):
            label_fn = 'processed_labels/' + f.split('/')[-1]
            features.append(N.loadtxt(f, delimiter=','))
            labels.append(N.loadtxt(label_fn, delimiter=','))

    os.chdir(cwd)
    return N.concatenate(features, axis=0), N.concatenate(labels, axis=0)
