// sndr.h -- Classes to perform sound classification tasks
// language: C++
// author  : Paris Smaragdis

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


#ifndef __SNDR_H
#define __SNDR_H

#include "intransp.h"
#include "aufeat.h"
#include "wavfile.h"

#include <sstream>
#include <iostream>
#include <list>
#include <vector>
#ifndef _WINDOWS
	#include <sys/time.h>
#endif

#ifdef __FLOAT
	typedef float real_t;
#else
	typedef double real_t;
#endif


//
// Audio feature extractor class
//

template <class T>
class AudioFeatureExtractor_t{
public:
	int b;   // Number of Mel coeffs
	int fb;  // Number of Mel filterbanks
	int hp;  // Hop size factor (1, 2, 4, etc) 
	int av;  // Feature averaging
	int sz;  // Analysis window in samples
	T tsz;   // Size of analysis window in seconds
	T flo;   // Lowest analysis frequency
	T fhi;   // Highest analysis frequency
	T thr;   // Silence threshold
	T srate; // Input sampling rate
	std::string fopts; // Audio feature options
	aufeat_t<T> F; // Feature extractor

	// Initializers
	AudioFeatureExtractor_t( int _b = 13, T _tsz = .1, T _flo = 120, T _fhi = 6855,
									int _fb = 30, std::string _fopts = std::string( "cdm"), 
									T _thr = 0, int _av = 1) : 
	b(_b), fb(_fb), hp( 0), av(_av), sz(0), tsz(_tsz), flo(_flo), fhi(_fhi), thr(_thr), 
	srate(0), fopts(_fopts), F() {}

	AudioFeatureExtractor_t( const AudioFeatureExtractor_t &f) : 
		b(f.b), tsz(f.tsz), flo(f.flo), fhi(f.fhi), fb(f.fb), hp(f.hp),  
	fopts(f.fopts), thr(f.thr), av(f.av), srate(0), sz(0), F(f.F) {}

	void report()
	{
		using namespace std;
		cout << "b = " << b << endl;
		cout << "fb = " << fb << endl;
		cout << "hp = " << hp << endl;
		cout << "av = " << av << endl;
		cout << "sz = " << sz << endl;
		cout << "tsz = " << tsz << endl;
		cout << "flo = " << flo << endl;
		cout << "fhi = " << fhi << endl;
		cout << "thr = " << thr << endl;
		cout << "srate = " << srate << endl;
		cout << "fopts = " << fopts << endl;
		F.report();
	}

	// Check options similarity
	bool operator==( const AudioFeatureExtractor_t<T> &A) const
	{
		return (b == A.b) && (fb == A.fb) && (hp == A.hp) && (av == A.av) &&
			(tsz == A.tsz) && (flo == A.flo) && (fhi == A.fhi) && (thr == A.thr) &&
			(srate == A.srate) && (fopts.compare( A.fopts) == 0);
	}
									
	// Extract sound features
	void operator()( const array<T> &s, int sr, array<T> &f, array<int> &p, bool thrm = false)
	{
		using namespace std;

		// Init the feature structure according to the new sample rate
		if( sr != srate){
			sz = pow( 2., int( log2( tsz*sr)));
			F.setup( sr, sz, round( 3.*log( double(sr))), b, flo, fhi, fopts);
//		F.report();
			srate = sr;
		}

		// Some preallocation
		array<T> e( (s.size()-sz)/(sz/hp)+1);
		
#if 0
		// Get features of input sound using online estimation (has 4-frame delay)
		f.resize( F.o, (s.size()-sz)/(sz/hp)+1);
		for( int i = 0, j = 0 ; i < s.size()-sz ; i+=sz/hp, j++){
			array<T> st( s.v+i, sz), ft( f.v+j*F.o, F.o);
			e(j) = F.extract( st, ft);
		}
#else
		// Get features of input sound using offline estimation
		F.extract_offline( s, sz/hp, f, e);
#endif
	
		// Mark low-energy frames if threshold is non-zero
		if( thr){
			// Get peak volume
			T pk = 0;
			for( int i = 0 ; i < e.size() ; i++)
				pk = max( pk, e(i));
			
			// Find passable frames
			p.resize( e.size());
			int pc = 0;
			for( int i = 0 ; i < e.size() ; i++){
				p(i) = e(i) >= thr*pk;
				pc += p(i);
			}

			// Remove silent frames if proper flag is set
			if( thrm){
				// Back up the data
				array<T> f2( f.m, f.n);
				for( int i = 0 ; i < f.size() ; i++)
					f2(i) = f(i);
				
				// Keep only the loud parts
				f.resize( F.o, pc);
				for( int i = 0, j = 0 ; i < e.size() ; i++){
					if( p(i)){
						for( int k = 0 ; k < F.o ; k++)
							f(k,j) = f2(k,i);
						j++;
					}
				}
				std::cout << "Volume trimmed from " << f2.n << " frames to " << f.n << " frames" << std::endl;
			}
		}
		
		// Feature averaging?
		if( av > 1){
			// Back up the data
			array<T> f2( f.m, f.n);
			for( int i = 0 ; i < f.size() ; i++)
				f2(i) = f(i);
			
			// Start averaging
			f.resize( F.o, f.n/av);
			for( int i = 0 ; i < f.m ; i++)
				for( int j = 0 ; j < f.n ; j++){
					f(i,j) = 0;
					for( int k = 0 ; k < av ; k++)
						if( j+k < f2.n)
							f(i,j) += f2(i,j+k);
					f(i,j) /= av;
				}
		}
		
		// Transpose in place to make the cache happy during training
		intp( &f(0), f.m, f.n);
		f.k = f.m; f.m = f.n; f.n = f.k; f.k = 1;
	}
};


//
// Audio feature container class
//

template <class T>
class AudioFeatures_t{
public:
	AudioFeatureExtractor_t<T> &F; // Feature extractor to use
	array<T> C; // Consolidated features
	std::list<array<T> > D; // Feature data
	std::list<array<int> > S; // Silent frame data

	// Initialize by providing the feature extractor
	AudioFeatures_t( AudioFeatureExtractor_t<T> &_F) : F(_F), C(), D(), S() {}

	// Append an additional sound in the learning dictionary
	void operator()( const array<T> &in, T sr, bool thrm = false)
	{
		D.push_back( array<T>());
		S.push_back( array<int>());
		F( in, sr, D.back(), S.back(), thrm);
	}

	// Consolidate all feature sets
	void consolidate()
	{
		// Figure out how much data we have
		int fs = 0;
		for( typename std::list<array<T> >::iterator i = D.begin() ; i != D.end() ; ++i)
			fs += (*i).m;

		// Nothing to do
//		if( fs == 0)
//			throw std::runtime_error( "AudioFeatures_t<T>::consolidate(): Can't consolidate data, list is empty");

		// Consolidate all features
		int ck = 0;
		int del = F.fopts.find( 'd') != std::string::npos;
		C.resize( fs-del*5*D.size(), D.front().n);
		while( D.size()){
			for( int k = del*5 ; k < D.front().m ; k++, ck++)
				for( int j = 0 ; j < D.front().n ; j++)
					C(ck,j) = D.front()(k,j);
			D.pop_front();
			S.pop_front();
		}
        #ifdef DEBUG
		std::cout << "Overall feature size " << C.m << 'x' << C.n << std::endl;
        #endif
	}

	// Clear buffers
	void clear()
	{
		C.resize( 0);
		while( D.size())
			D.pop_front();
		while( S.size())
			S.pop_front();
	}
};

#endif
