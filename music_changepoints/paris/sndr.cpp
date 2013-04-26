// sndr.cpp -- Driver source code for sound recognition tasks
// language: C++
// author  : Paris Smaragdis
// copyright: (c) 2010 Adobe Systems Incorporated, All Rights Reserved

/*************************************************************************
 *
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2010 Adobe Systems Incorporated
 *  All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 **************************************************************************/


#include "sndr.h"
#include "optparse.h"

#ifdef _WINDOWS
	#include <windows.h>
#endif

using namespace std;


//
// Timing functions
//

// Start counting
double _tic_start_time;
void tic()
{
#ifndef _WINDOWS
	struct timeval time;
	gettimeofday( &time, NULL);
	_tic_start_time = time.tv_sec + double( time.tv_usec)/1000000.;
#else
	// Figure out the clock frequency
	double gClockFrequency;
	LARGE_INTEGER frequency;
	if( QueryPerformanceFrequency( &frequency))
		gClockFrequency = (double)frequency.QuadPart;
	
	// Get time
	LARGE_INTEGER c;
	if( QueryPerformanceCounter( &c))
		_tic_start_time = (double)(c.QuadPart) / gClockFrequency;
	else
		_tic_start_time = -1;
#endif
}

// Get elapsed time
double toc()
{
#ifndef _WINDOWS
	struct timeval time;
	gettimeofday( &time, NULL);
	double end_time = time.tv_sec + double( time.tv_usec)/1000000.;
	return end_time - _tic_start_time;
#else
	// Figure out the clock frequency
	double gClockFrequency;
	LARGE_INTEGER frequency;
	if( QueryPerformanceFrequency( &frequency))
		gClockFrequency = (double)frequency.QuadPart;
	
	// Get time
	double end_time;
	LARGE_INTEGER c;
	if( QueryPerformanceCounter( &c))
		end_time = (double)(c.QuadPart) / gClockFrequency;
	else
		end_time = -1;
	
	// Return difference
	return end_time - _tic_start_time;
#endif
}


//
// Main routine
//

#ifdef __FLOAT
	typedef float real_t;
#else
	typedef double real_t;
#endif

int main( int argc, const char **argv)
{
	AudioFeatureExtractor_t<real_t> A;

	//
	// Get options
	//

	// Model options
	int K = getoption<int>( "-K", argc, argv, 8, "Number of Gaussians"); // Number of Gaussians per GMM
#ifdef __HMM_TRAIN
	int S = getoption<int>( "-S", argc, argv, 8, "Number of HMM states"); // Number of HMM models states
#endif
	int it = getoption<int>( "-e", argc, argv, 50, "Number of learning iterations"); // Number of learning iterations
	real_t trans = getoption<real_t>( "-p", argc, argv, .999, "Transition likelihood"); // Transition likelihood (log lik for other states if negative, lik for diagonal if positive)
	array<real_t> r = mgetoption<real_t>( "-r", argc, argv, "State transition bias"); // State transition bias
	array<real_t> bias = mgetoption<real_t>( "-B", argc, argv, "Likelihood bias"); // Likelihood bias
	int mf = getoption<int>( "-f", argc, argv, 0, "Length of state output filter"); // Length of state output filter
	real_t mw = getoption<real_t>( "-w", argc, argv, 1, "Bias of state output filter"); // Bias of state output filter

	// Analysis options
	A.fopts = getoption<string>( "-F", argc, argv, string( "cdm"), "Feature options"); // Feature options string
	A.b = getoption<int>( "-n", argc, argv, 13, "Feature coefficients"); // Number of coeffs to use
	A.flo = getoption<real_t>( "-l", argc, argv, 80, "Lowest frequency"); // Lowest frequency
	A.fhi = getoption<real_t>( "-h", argc, argv, 7500, "Highest frequency"); // Highest frequency
	A.fb = getoption<int>( "-b", argc, argv, 32, "Filterbank filters"); // Filterbank filters

	// Time and amplitude scale options
	A.thr = getoption<real_t>( "-T", argc, argv, 0, "Peak threshold"); // Peak threshhold
	A.tsz = getoption<real_t>( "-t", argc, argv, 0.1, "Window size"); // window size in seconds
	A.hp = getoption<int>( "-H", argc, argv, 1, "Hop size"); // Hop size (window size/hp)
	A.av = getoption<int>( "-a", argc, argv, 1, "Feature averaging"); // Feature averaging

	// Get filenames
	string modout = getoption<string>( "-M", argc, argv, "", "Output model filename"); // Output model filename
	string dump = getoption<string>( "-d", argc, argv, "", "Dump file prefix"); // Dump file prefix
	array<string> infile = mgetoption<string>( "-i", argc, argv, "Input soundfile(s)"); // Input soundfile(s)
	array<string> modin = mgetoption<string>( "-m", argc, argv, "Input models"); // Input model filenames
	string edl = getoption<string>( "-D", argc, argv, "", "EDL file name prefix"); // EDL file name prefix
	array<string> trg = mgetoption<string>( "-g", argc, argv, "Target file"); // Target source files (enables sound tracking)

	// Start counting time
	tic();

	// Decide what needs to be done
	if( modin.size()){

		//
		// Classify an input sound given pre-trained models
		//

		cout << "Classifying ..." << endl;

		AudioClassifier_t<real_t> C( A);

		// Set some decoding parameters
		C.filter( mf, mw);
		C.trans = trans;
		C.bias = bias;
		C.r = r;

		// Load classifiers and combine them if necessary
		if( modin.size() == 1)
			C.load( modin(0));
		else
			C.combine_models( modin, modout);

		// Go through all files and perform classification
		for( int i = 0 ; i < infile.size() ; i++){
			wavfile_t f( infile(i), ios::in);
			array<real_t> x( f.frames);
			f.read_mono( x);
			C( x, int( f.samplerate));

			// Make output files with each sound class
			if( dump.size()){
				for( int j = 0 ; j < C.C ; j++){
					char nm[512];
					sprintf( nm, "%s.%s.%d.wav", infile(i).c_str(), dump.c_str(), j);
					C.make_snd( x, nm, j);
				}
			}

			// Make EDL file
			if( edl.size()){
				for( int j = 0 ; j < C.C ; j++){
					char nm[512];
					sprintf( nm, "%s.%s.%d.edl", infile(i).c_str(), edl.c_str(), j);
					C.make_edl( string( nm), j);
				}
			}

		}

	}else if( trg.size()){

		//
		// Learn to track a sound
		//

		cout << "Learning ..." << endl;
		
		// Add all the example sounds in the dictionary
		AudioFeatures_t<real_t> F( A);
		for( int i = 0 ; i < infile.size() ; i++){
			cout << "Learning from " << infile(i) << endl;
			wavfile_t f( infile(i), ios::in);
			array<real_t> x( f.frames);
			f.read_mono( x);
			F( x, f.samplerate, true);
		}
		
		// Learn a model and save it
		AudioModel_t<real_t> M( A, K);
		M( F, it);
		M.save( modout + string( "-ubm"));

		// Add all the target sounds in the dictionary
		F.clear();
		for( int i = 0 ; i < trg.size() ; i++){
			cout << "Learning from " << trg(i) << endl;
			wavfile_t f( trg(i), ios::in);
			array<real_t> x( f.frames);
			f.read_mono( x);
			F( x, f.samplerate, true);
		}

		// Learn the target file based on the universal model
		AudioModel_t<real_t> Mt( A, K);
		Mt( F, it, M.G);
		Mt.save( modout + string( "-target"));

	}else{
			
		//
		// Learn a model from a bunch of example sounds
		//

		cout << "Learning ..." << endl;

		// Add all the example sounds in the dictionary
		AudioFeatures_t<real_t> F( A);
		for( int i = 0 ; i < infile.size() ; i++){
			wavfile_t f( infile(i), ios::in);
			array<real_t> x( f.frames);
			f.read_mono( x);
			F( x, f.samplerate, true);
		}

		// Learn a model and save it
#ifdef __HMM_TRAIN
		AudioModel_t<real_t> M( A, K, S);
#else
		AudioModel_t<real_t> M( A, K);
#endif
		M( F, it);
		M.save( modout);
	}

	// Time?
	cout << "Done in " << toc() << " sec" << endl;
}
