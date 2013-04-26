/* novelty.cpp - find interesting change points in music */
#define __FFTW
#include <stdio.h>
#include <eigen3/Eigen/Core>
#include <eigen3/Eigen/Dense>
#include <cmath>
#include <iostream>
#include <vector>
#include <algorithm>
#include <utility>
#include <fstream>
#include <string>

// note: this version of wavfile.h is slightly modified from Paris's version
// so it also reads stereo audio
#include "paris/wavfile.h"
#include "paris/array.h"
#include "paris/sndr.h"

#define MSWLEN 100

using namespace Eigen;
using namespace std;

// struct for settings
struct NoveltySettings {
    int k;
    string feature;
    string dist;
    int nres;
};

// default parameters for different feature types
const struct NoveltySettings NOVELTY_SETTINGS_RMS_DEFAULT = {
    64, "rms", "euc", 5
};

const struct NoveltySettings NOVELTY_SETTINGS_MFCC_DEFAULT = {
    64, "mfcc", "cos", 5
};

const struct NoveltySettings NOVELTY_SETTINGS_CHROMA_DEFAULT = {
    64, "chroma", "euc", 5
};

// these are needed for the peak sortings
typedef pair<int, double> PeakPair;
struct CmpPeakPair
{
    bool operator() (const PeakPair& a, const PeakPair& b) {
        return a.second > b.second;
    }
};

double* findChangepointsRMS (string filename);
double* findChangepointsMFCC (string filename);
double* findChangepointsChroma (string filename);
double* findChangepoints (string filename, NoveltySettings ns);

double* findChangepointsHelper (wavfile_t f, NoveltySettings ns=NOVELTY_SETTINGS_RMS_DEFAULT);
ArrayXd similarityMatrixAndResponse (const VectorXd& song, string feature, string dist, int k);

ArrayXd gaussian (int k);
ArrayXd hamming (int len);
ArrayXd hanning (int len);
vector<PeakPair> peaks (const ArrayXd& vec, int smoothingParam);
ArrayXd smooth (const ArrayXd& vec, int len);

void printVector (const ArrayXd& vec);
void printVector (const ArrayXi& vec);
void printMinutes (double seconds);

/* to run:
    ./novelty <PATH TO WAV FILE> <(int) KERNEL SIZE> <FEATURE> 
              <DISTANCE METRIC> <(int) MAX RESULTS>
    or
    ./novelty <PATH TO WAV FILE> <FEATURE>
*/
int main (int argc, char const *argv[])
{
    double *changePoints;
    int nresults;

    if (argc == 3) {
        string filename = argv[1];
        string feature = argv[2];
        
        if (feature.compare("rms") == 0) {
            changePoints = findChangepointsRMS(filename);
            nresults = NOVELTY_SETTINGS_RMS_DEFAULT.nres;
        } else if (feature.compare("mfcc") == 0) {
            changePoints = findChangepointsMFCC(filename);
            nresults = NOVELTY_SETTINGS_MFCC_DEFAULT.nres;
        } else if (feature.compare("chroma") == 0) {
            changePoints = findChangepointsChroma(filename);
            nresults = NOVELTY_SETTINGS_CHROMA_DEFAULT.nres;
        } else {
            cout << "Did not recognize feature " << feature << endl <<
                "Try rms, mfcc, or chroma" << endl;
            return 1;
        }
    }
    else if (argc > 5) {
        string filename = argv[1];
        string feature = argv[3];
        string distanceMetric = argv[4];
        char * pEnd;
        int k = strtol(argv[2], &pEnd, 10);
        char * pEnd2;
        nresults = strtol(argv[5], &pEnd2, 10);

        struct NoveltySettings settings = {
            k, feature, distanceMetric, nresults
        };
        
        changePoints = findChangepoints(filename, settings); 
    } else {
        cout << "Proper usage: novelty <WAV file> <kernel size>" <<
            " <feature> <metric> <max # results>" << endl << 
            "or: novelty <WAV file> <feature>"<< endl;
        return 1;
    }
    
    for (int i = 0; i < nresults; i++)
    {
        cout << changePoints[i] << endl;
    }
    
    return 0;
}

/* 
    Compute similarity matrix for a song given a feature and a distance
*/
template <unsigned int SRATE>
ArrayXd similarityMatrixAndResponse (VectorXd& song, string feature, string dist, int k)
{
    MatrixXd features;
    int nwindows;

    const int WLEN = pow(2., int(log2(SRATE * MSWLEN / 1000.)));

    bool rms, mfcc, chroma;
    rms = feature.compare("rms") == 0;
    mfcc = feature.compare("mfcc") == 0;
    chroma = feature.compare("chroma") == 0;
    
    if (rms) {
        nwindows = int(2 * song.size() / WLEN - 1);
        features = MatrixXd(nwindows, 1);
        const double rootWLEN = sqrt(WLEN);
        // compute the RMS energy on each window
        MatrixXd hamWindow = hamming(WLEN).matrix();
    
        for (int i = 0; i < nwindows; i++)
        {
            features(i) = song.segment(i * (WLEN / 2), WLEN)
                .cwiseProduct(hamWindow).norm() / rootWLEN;
        }
    } else if (chroma) {
        nwindows = int(2 * song.size() / WLEN - 1);
        
        // setup the fft properties
        // for the audio extractor (via Paris's code)
        AudioFeatureExtractor_t<double> AFE;
    	AFE.tsz = 0.1;        // window size in seconds
    	AFE.hp = 2;           // Hop size (window size/hp)
        AFE.av = 1;           // Feature averaging
        AFE.fopts = "";     // Feature options string (dct, mfcc)

        AudioFeatures_t<double> AF(AFE);
        array<double> array_song(song.data(), song.size(), 1, 1);
        AF(array_song, SRATE, false);
        AF.consolidate();
        
        // get the features in an Eigen matrix
        MatrixXd specgram = Map<MatrixXd>(AF.C.v, nwindows, 2049);
        
        // double f_ctr = 1000;
        double A0 = 27.5;
        double A440 = 440;
        // double f_ctr_log = log2(f_ctr/A0);
        int nbins = 12; // one for each note of the scale

        // create the weights matrix to multiply the spectrogram by
        MatrixXd weights = MatrixXd::Zero(specgram.cols(), specgram.rows());
        
        VectorXd fftFreqBins = VectorXd::LinSpaced(WLEN, 0, WLEN - 1);
        fftFreqBins = nbins * (fftFreqBins / (A0 * WLEN) * SRATE)
            .array().log() / log(2);
        fftFreqBins(0) = fftFreqBins(1) - 1.5 * nbins;
         
        VectorXd binWidthBins = VectorXd(WLEN);
        for (int i = 0; i < WLEN - 1; i++)
        {
            binWidthBins(i) = max(1., fftFreqBins(i + 1) - fftFreqBins(i));
        }
        binWidthBins(WLEN - 1) = 1;
        
        VectorXd tmpBinsVector = VectorXd::LinSpaced(12,0,11);
        
        MatrixXd D = fftFreqBins.matrix().replicate(1, nbins) -
            tmpBinsVector.replicate(1, WLEN).transpose();
        
        D = (double(nbins) * (((D.array() + nbins/2 + 10*nbins) / nbins) -
            ((D.array() + nbins/2 + 10*nbins) / nbins)
                .cast<int>().cast<double>())) - double(nbins) / 2;
        
        weights = (-0.5 * 
                (2.0 * D.array() / binWidthBins.replicate(1, nbins).array())
                    .square()).exp();

        weights = weights.array() / 
            weights.array().square().rowwise().sum().sqrt()
                .replicate(1, nbins);
        
        // zero out aliasing columns
        // weights.bottomRows(WLEN / 2 - 1) = 
        //     ArrayXXd::Zero(WLEN / 2 - 1, nbins);
        
        weights = weights.topRows(WLEN / 2 + 1);
        
        // and finally, compute the chromagram
        features = specgram * weights.matrix();
    } else if (mfcc) {
        nwindows = int(2 * song.size() / WLEN - 1);
        
        // setup the mfcc properties
        // for the audio extractor (via Paris's code)
        AudioFeatureExtractor_t<double> AFE;
        AFE.b = 13;           // number of coefficients
        AFE.flo = 80.0;       // lowest frequency
        AFE.fhi = 7500.0;     // highest frequency
        AFE.fb = 32;          // filterbank filters
    	AFE.thr = 0.0;        // Peak threshhold
    	AFE.tsz = 0.1;        // window size in seconds
    	AFE.hp = 2;           // Hop size (window size/hp)
    	AFE.av = 1;           // Feature averaging
        AFE.fopts = "cm";     // Feature options string (dct, mfcc)
        
        // compute the audio features
        AudioFeatures_t<double> AF(AFE);
        array<double> array_song(song.data(), song.size(), 1, 1);
        AF(array_song, SRATE, false);  
            // last option is whether to trim silence
        AF.consolidate();
        
        // get the features in an Eigen matrix
        features = Map<MatrixXd>(AF.C.v, nwindows, 12);
        
        // subtract the spectral mean
        VectorXd spectralMean = features.colwise().mean();
        features = (features.array().rowwise() -
            spectralMean.transpose().array()).matrix();        
    }

    #ifdef DEBUG
    cout << "Computed features" << endl;
    #endif
    
    // run the checkerboard kernel along the diagonal of the similarity matrix
    ArrayXXd kernel = ArrayXXd(2 * k, 2 * k);
    kernel.topLeftCorner(k, k) = kernel.bottomRightCorner(k, k) =
        MatrixXd::Ones(k, k);
    kernel.topRightCorner(k, k) = kernel.bottomLeftCorner(k, k) =
        MatrixXd::Ones(k, k).array() * -1;
    ArrayXd taper = gaussian(k);
    
    ArrayXXd checkerboard = kernel *
        (taper.matrix() * taper.matrix().transpose()).array();
    
    #ifdef DEBUG
    cout << "Created checkerboard kernel" << endl;
    #endif
    
    ArrayXd response = VectorXd::Zero(nwindows);;
    ArrayXXd similarityBuffer = ArrayXXd(2 * k, 2 * k);
    
    if (dist.compare("euc") == 0) {
        if (rms) {
            for (int i = 0; i < 2*k; i++)
            {
                for (int j = i; j < 2*k; j++)
                {
                    similarityBuffer(i, j) = 1 - abs(features(i) - features(j));
                    similarityBuffer(j, i) = similarityBuffer(i, j);
                }
            }
            
            response(k) = (similarityBuffer * checkerboard).sum();
        
            int next_window = 2 * k;
        
            for (int i = k + 1; i < nwindows - k + 1; i++, next_window++)
            {
                similarityBuffer.topLeftCorner(2*k-1, 2*k-1) =
                    similarityBuffer.bottomRightCorner(2*k-1, 2*k-1);
            
                for (int h = 0; h < 2 * k; h++)
                {
                    similarityBuffer(2 * k - 1, h) =
                        1 - abs(features(next_window) - 
                            features(next_window - (2 * k) + (h + 1)));
                    similarityBuffer(h, 2 * k - 1) = similarityBuffer(2 * k - 1, h);
                }
                response(i) = (similarityBuffer * checkerboard).sum();
            }
        } else if (mfcc || chroma) {
            for (int i = 0; i < 2*k; i++)
            {
                for (int j = i; j < 2*k; j++)
                {
                    similarityBuffer(i, j) = 1 - (features.row(i) -
                         features.row(j)).squaredNorm();
                    similarityBuffer(j, i) = similarityBuffer(i, j);
                }
            }
            
            response(k) = (similarityBuffer * checkerboard).sum();
        
            int next_window = 2 * k;
        
            for (int i = k + 1; i < nwindows - k + 1; i++, next_window++)
            {
                similarityBuffer.topLeftCorner(2*k-1, 2*k-1) =
                    similarityBuffer.bottomRightCorner(2*k-1, 2*k-1);
            
                for (int h = 0; h < 2 * k; h++)
                {
                    similarityBuffer(2 * k - 1, h) =
                        1 - (features.row(next_window) - 
                             features.row(next_window - (2 * k) + (h + 1)))
                        .squaredNorm();
                    similarityBuffer(h, 2 * k - 1) = similarityBuffer(2 * k - 1, h);
                }
                response(i) = (similarityBuffer * checkerboard).sum();
            }
        }
    } else if (dist.compare("cos") == 0) {
        if (rms) {
            cout << "Can't use cosine distance with RMS energy feature" << endl;
            exit(1);
        } else if (mfcc || chroma) {
            for (int i = 0; i < 2*k; i++)
            {
                for (int j = i; j < 2*k; j++)
                {
                    similarityBuffer(i, j) = .5 + .5 *
                        features.row(i).dot(features.row(j)) /
                        (features.row(i).norm() * features.row(j).norm());
                    similarityBuffer(j, i) = similarityBuffer(i, j);
                }
            }
            
            response(k) = (similarityBuffer * checkerboard).sum();
        
            int next_window = 2 * k;
        
            for (int i = k + 1; i < nwindows - k + 1; i++, next_window++)
            {
                similarityBuffer.topLeftCorner(2*k-1, 2*k-1) =
                    similarityBuffer.bottomRightCorner(2*k-1, 2*k-1);
            
                for (int h = 0; h < 2 * k; h++)
                {
                    similarityBuffer(2 * k - 1, h) =
                        .5 + .5 * features.row(next_window)
                        .dot(features.row(next_window - (2 * k) + (h + 1))) /
                        (features.row(next_window).norm() * 
                         features.row(next_window - (2 * k) + (h + 1)).norm());
                    similarityBuffer(h, 2 * k - 1) = similarityBuffer(2 * k - 1, h);
                }
                response(i) = (similarityBuffer * checkerboard).sum();
            }
        }
    }
    return response;

    
    // // compute the similarity matrix
    // ArrayXXd similarity = ArrayXXd(nwindows, nwindows);
    // 
    // if (dist.compare("euc") == 0) {
    //     if (rms) {
    //         for (int i = 0; i < nwindows; i++)
    //         {
    //             // we only have to compute +/- k from the diagonal
    //             // fix?
    //             for (int j = i; j < nwindows; j++)
    //             {
    //                 similarity(i, j) = 1 - abs(features(i) - features(j));
    //                 similarity(j, i) = similarity(i, j);
    //             }
    //         }
    //         double minCoeff = similarity.minCoeff();
    //         similarity = (similarity - minCoeff) / (1.0 - minCoeff);           
    //     } else if (mfcc || chroma) {
    //         for (int i = 0; i < nwindows; i++)
    //         {
    //             for (int j = i; j < nwindows; j++)
    //             {
    //                 similarity(i, j) = 1 - (features.row(i) -
    //                      features.row(j)).squaredNorm();
    //                 similarity(j, i) = similarity(i, j);
    //             }
    //         }
    //     }
    // } else if (dist.compare("cos") == 0) {
    //     if (mfcc || chroma) {
    //         for (int i = 0; i < nwindows; i++)
    //         {
    //             for (int j = i; j < nwindows; j++)
    //             {
    //                 similarity(i, j) = .5 + .5 *
    //                     features.row(i).dot(features.row(j)) /
    //                     (features.row(i).norm() * features.row(j).norm());
    //                 similarity(j, i) = similarity(i, j);
    //             }
    //         }
    //     }
    // }
    // 
    // #ifdef DEBUG
    // cout << "Computed similarities" << endl;
    // #endif
    // 
    // 
    // ArrayXd response = VectorXd::Zero(nwindows);
    // for (int i = k; i < nwindows - k; i++)
    // {
    //     response(i) = (similarity.block(i - k, i - k, 2 * k, 2 * k) *
    //         checkerboard).sum();
    // } 
    // return response;
}

template <unsigned int SRATE>
double* findChangepointsHelper (string filename, NoveltySettings ns=NOVELTY_SETTINGS_RMS_DEFAULT)
{
    wavfile_t f(filename, ios::in);
    
    const int WLEN = pow(2., int(log2(SRATE * MSWLEN / 1000.)));
    
    int k = ns.k;
    string feature = ns.feature;
    string dist = ns.dist;
    int nres = ns.nres;
    
    array<double> x(f.frames);
    array<double> y(f.frames);
    f.read_stereo(x, y);
    VectorXd ch1 = Map<VectorXd>(x.v, f.frames);
    VectorXd ch2 = Map<VectorXd>(y.v, f.frames);
    VectorXd song = ch1 + ch2;
    
    bool rms, mfcc, chroma;
    rms = feature.compare("rms") == 0;
    mfcc = feature.compare("mfcc") == 0;
    chroma = feature.compare("chroma") == 0;
    
    #ifdef DEBUG
    cout << "Wav file has been read" << endl;
    #endif
    
    ArrayXXd similarity;
    
    ArrayXd response;
    if (rms || mfcc || chroma) {
        response = similarityMatrixAndResponse<SRATE>(song, feature, dist, k);     
    } else {
        cout << "Run with feature rms, mfcc, or chroma." << endl;
        exit(1);
    }

    int nwindows = int(2 * song.size() / WLEN - 1);
    
    #ifdef DEBUG
    cout << "Computed checkerboard response" << endl;
    #endif
    
    // peak detection (smooth + peak finding + re-center at local max)
    vector<PeakPair> noveltyPeaks = peaks(response, k / 2 + 1);
    
    #ifdef DEBUG
    cout << "Found peaks" << endl;
    #endif
    
    // match output to python script
    cout.setf(ios::fixed, ios::floatfield);
    cout.precision(6);
    
    // only return results that go from low RMS to high RMS
    vector<PeakPair>::iterator pIt;
    vector<PeakPair> finalPeaks;
    int peaksFound = 0;
    
    double *changePoints = new double[nres];
    
    for (pIt = noveltyPeaks.begin(); pIt != noveltyPeaks.end(); pIt++)
    {
        PeakPair ppair = *pIt;
        int window = ppair.first;
    
        if (rms) {
            if (window > k / 2 && window < nwindows - k / 2) {
                double leftRMS = song.segment(
                        (window - k) * WLEN / 2, k * WLEN / 2
                    ).norm();
                double rightRMS = song.segment(
                        window * WLEN / 2, k * WLEN / 2
                    ).norm();
                if (leftRMS < rightRMS) {
                    finalPeaks.push_back(ppair);

                    double time = (WLEN / double(SRATE)) * ppair.first / 2.0;
                
                    #ifdef DEBUG
                    cout << peaksFound << ": ";
                    printMinutes(time);
                    cout << "\tscore:" << ppair.second << endl;
                    #endif

                    changePoints[peaksFound] = time;
                    peaksFound++;
                    
                    if (peaksFound == nres) {
                        break;
                    }
                }
            }            
        } else if (mfcc || chroma) {
            // ignore first 10 seconds and last 10 seconds of the song
            // TURNED OFF - probably shouldn't do this by default, but it's
            // useful in many cases
            int padding = 0;
            // Uncomment to turn back on
            // int padding = 20.0 * SRATE / WLEN;

            if (ppair.first > padding && ppair.first < nwindows - padding) {
                finalPeaks.push_back(ppair);
                double time = (WLEN / double(SRATE)) * ppair.first / 2.0;
            
                #ifdef DEBUG
                cout << peaksFound << ": ";
                printMinutes(time);
                cout << "\tscore:" << ppair.second << endl;
                #endif
                
                changePoints[peaksFound] = time;
                peaksFound++;
                
                if (peaksFound == nres) {
                    break;
                }            
            }
        }
    }
    return changePoints;
}

double* findChangepointsRMS (string filename)
{
    return findChangepoints(filename, NOVELTY_SETTINGS_RMS_DEFAULT);
}

double* findChangepointsMFCC (string filename)
{
    return findChangepoints(filename, NOVELTY_SETTINGS_MFCC_DEFAULT);
}

double* findChangepointsChroma (string filename)
{
    return findChangepoints(filename, NOVELTY_SETTINGS_CHROMA_DEFAULT);
}

/* 
    Find changepoints in a song.
    filename: path to wav file
    
    NoveltySettings. A struct with:
        k:        size of checkerboard kernel
        feature:  rms, mfcc, chroma
        dist:     euc, cose
        nres: maximum number of results returned
*/
double* findChangepoints (string filename, NoveltySettings ns=NOVELTY_SETTINGS_RMS_DEFAULT)
{
    wavfile_t f(filename, ios::in);
    int samplerate = f.samplerate;
    
    double *results;
    
    switch (samplerate) 
    {
        case 8000:
            results = findChangepointsHelper<8000>(filename, ns); 
            break;
        case 16000:
            results = findChangepointsHelper<16000>(filename, ns);
            break;
        case 22050:
            results = findChangepointsHelper<22050>(filename, ns); 
            break;
        case 32000:
            results = findChangepointsHelper<32000>(filename, ns);  
            break;
        case 44100:
            results = findChangepointsHelper<44100>(filename, ns);  
            break;
        case 48000:
            results = findChangepointsHelper<48000>(filename, ns);   
            break;
        case 96000:
            results = findChangepointsHelper<96000>(filename, ns);   
            break;
        default:
            cout << "Please use one of the supported sample rates" << endl;
            exit(EXIT_FAILURE);
    }
    return results;
}


// generate a 1D gaussian of length 2*k with sigma = k
ArrayXd gaussian (int k)
{
    double sigma = double(k);
    ArrayXd tmp = ArrayXd(2 * k);
    for (int i = 0; i < 2 * k; i++)
    {
        tmp(i) = i - (2 * k - 1.0) / 2.0;
    }
    int sigma2 = 2 * sigma * sigma;
    return (-1 * tmp * tmp / sigma2).exp();
}

// generate a hamming window of length len
ArrayXd hamming (int len)
{
    if (len == 1) {
        return ArrayXd::Ones(1);
    }
    ArrayXd tmp = ArrayXd::LinSpaced(len, 0, len - 1);
    return 0.54 - 0.46 * (tmp * 2.0 * 3.14159 / (len - 1)).cos();
}

// generate a hanning window of length len
ArrayXd hanning (int len)
{
    if (len == 1) {
        return ArrayXd::Ones(1);
    }
    ArrayXd tmp = ArrayXd::LinSpaced(len, 0, len - 1);
    return 0.5 - 0.5 * (tmp * 2.0 * M_PI / (len - 1)).cos();
}

// find the peaks of a vector (corresponds to naive_peaks in novelty.py)
vector<PeakPair> peaks (const ArrayXd& vec, int smoothingParam = 33)
{
    int halfSP = smoothingParam / 2;
    
    // if we're going to keep this fixed at 33, we can clean up the code
    ArrayXd smoothed = smooth(vec, smoothingParam);
    ArrayXi peaksArr = ArrayXi::Zero(smoothed.size());
    int sz = smoothed.size();
    
    
    ArrayXi part1 = ArrayXi(sz);
    ArrayXi part2 = ArrayXi(sz);
    part1 << ArrayXi::Ones(1),
                    ((smoothed.tail(sz - 1) - smoothed.head(sz - 1)) > 0)
                        .cast<int>();
    part2 << ((smoothed.head(sz - 1) - smoothed.tail(sz - 1)) > 0)
                        .cast<int>(),
                    ArrayXi::Ones(1);
    peaksArr = (part1 + part2 == 2).cast<int>();
    
    int peakCount = (peaksArr == 1).count();
    ArrayXi peakMaxIndex = ArrayXi(peakCount);
    ArrayXd peakMaxValue = ArrayXd(peakCount);
    
    int currentMaxIdx = 0;
    for (int i = halfSP; i < sz - halfSP; i++)
    {
        if (peaksArr(i) == 1) {
            ArrayXd::Index maxIdx;
            double maxVal = vec.segment(i - halfSP, smoothingParam)
                .maxCoeff(&maxIdx);
            maxIdx += i - halfSP;
            peakMaxIndex(currentMaxIdx) = int(maxIdx);
            peakMaxValue(currentMaxIdx) = maxVal;
            currentMaxIdx++;
        }
    }
    
    // now that we have all of the peaks and their values,
    // we need to sort them
    vector<PeakPair> sortedPeaks;
    sortedPeaks.reserve(peakCount);
    for (int i = 0; i < peakCount; i++)
    {
        sortedPeaks.push_back(PeakPair(peakMaxIndex[i], peakMaxValue[i]));
    }
    
    sort(sortedPeaks.begin(), sortedPeaks.end(), CmpPeakPair());
    
    return sortedPeaks;
}

// smooth a vector
ArrayXd smooth (const ArrayXd& vec, int len)
{
    if (len < 3) {
        return vec;
    }
    
    // use a hamming window
    ArrayXd w = hanning(len) / hanning(len).sum();  // not the prettiest
    
    // extending vec to the left and right to make our convolution do-able
    ArrayXd s = ArrayXd(vec.size() + 2 * len - 2);
    s.segment(0, len - 1) = vec.head(len - 1).reverse();
    s.segment(len - 1, vec.size()) = vec;
    s.segment(len + vec.size() - 1, len - 1) = vec.tail(len - 1).reverse();
    
    // convolve vec with the hamming window
    ArrayXd y = ArrayXd(vec.size());
    for (int i = 0; i < vec.size(); i++)
    {
        y(i) = (s.segment(i, len) * w).sum();
    }
    return y;
}

// for debugging purposes
void printVector (const ArrayXd& vec)
{
    cout << "Vector size: " << vec.size() << endl;
    for (int i = 0; i < vec.size(); i++)
    {
        cout << vec[i] << ' ';
    }
    cout << endl;
}

void printVector (const ArrayXi& vec)
{
    cout << "Vector size: " << vec.size() << endl;
    for (int i = 0; i < vec.size(); i++)
    {
        cout << vec[i] << ' ';
    }
    cout << endl;
}

void printMinutes (double seconds)
{
    int minutes = int(seconds / 60);
    double sec = seconds - 60 * minutes;
    double ms = seconds - 60 * minutes - sec;
    printf("%02d:%05.2f", minutes, sec);
}

