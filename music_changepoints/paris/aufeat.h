// aufeat.h -- Class to extract audio features
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


#ifndef __AUFEAT_H__
#define __AUFEAT_H__

#include "mathutils.h"

#include <iostream>
#include <fstream>
#include <string>
#include <stdexcept>

#include "array.h"
#ifdef __FFTW
	#include "fftw3.h"
#else
	#include "ipp.h"
#endif


//
// Audio features class
//

// Bark scale frequencies
const double Bark_freq[] = {
	50, 150, 250, 350, 450, 570, 700, 840, 1000, 
	1170, 1370, 1600, 1850, 2150, 2500, 2900, 3400, 
	4000, 4800, 5800, 7000, 8500, 10500, 13500
};

// Audio feature class
template <class T>
class aufeat_t{
public:
	T sr, min_f, max_f;
	int sz, nf, b, o, od; // fft size, number of filters, number of coeffs, eventual output size, delta filter estimator size
	bool delta, delta2, zero, energy, bark, mel, dct, nrm, lg, tran;
	array<T> W, DCT, w, Tm, Tt;

	// Buffer crap due to delta estimation
	array<T> buf;
	int bc, cf;
	int cmod( int i, int j)
	{
		while( i >= j)
			i -= j;
		while( i < 0)
			i += j;
		return i;
	}

	// FFT parameters
#ifdef __FFTW
	#ifdef __FLOAT
		fftwf_plan fft;
	#else
		fftw_plan fft;
	#endif
#else
	#ifdef __FLOAT
		IppsFFTSpec_R_32f *FFTSpec;
	#else
		IppsFFTSpec_R_64f *FFTSpec;
	#endif
	array<unsigned char> ftb;
#endif
	array<T> fx;

	// Mel/Hz conversions
	T Hz2mel( T f) { return 1127.01048 * log( 1.+f/700.); }
	T mel2Hz( T m) { return 700.*(exp( m/1127.01048)-1.); }

	// Constructor/destructor
	aufeat_t( const aufeat_t &a) { throw std::runtime_error( "audfeat_t::aufeat_t(): Don't even try to copy aufeat_t ..."); }
	int operator=( const aufeat_t &a) { throw std::runtime_error( "audfeat_t::aufeat_t(): Don't even try to copy aufeat_t ..."); }
	aufeat_t() : sr(0), min_f(0), max_f(0), sz(0), nf(0), b(0), o(0), od(0), 
		delta(false), delta2(false), zero(false), energy(false), bark(false), mel(false),
		dct(false), nrm(false), lg(false), tran(false), W(), DCT(), w(), Tm(), Tt(),
		buf(), bc(0), cf(0),
#ifndef __FFTW
		 FFTSpec(NULL), ftb(),
#endif
		  fx() {}

	~aufeat_t()
	{
#ifdef __FFTW
	#ifdef __FLOAT
		fftwf_destroy_plan( fft);
	#else
		fftw_destroy_plan( fft);
	#endif
#else
	#ifdef __FLOAT
		ippsFFTFree_R_32f( FFTSpec);
	#else
		ippsFFTFree_R_64f( FFTSpec);
	#endif
#endif
	}

	void report()
	{
		using namespace std;
		cout << "pntr " << this << endl;
		cout << "param " << sr << ' ' << sz << ' ' << nf << ' ' << b << ' ' << min_f << ' ' << max_f << endl;
		cout << "buf " << buf.m << ' ' << buf.n << ' ' << buf.k << ' ' << buf.v << endl;
	}

	// Setup
	void setup( T _sr, int _sz, int _nf, int _b, T mn, T mx, const std::string &O, const std::string tf = std::string( ""))
	{
		// Make local copies
		sr = _sr, sz = _sz, nf = _nf, b = _b, min_f = mn, max_f = mx;

		// Parse the options string
		bark = O.find( 'b') != std::string::npos;
		mel = O.find( 'm') != std::string::npos;
		delta = O.find( 'd') != std::string::npos;
		delta2 = O.find( 'D') != std::string::npos;
		zero = O.find( '0') != std::string::npos;
		energy = O.find( 'e') != std::string::npos;
		dct = O.find( 'c') != std::string::npos;
		nrm = O.find( 'n') != std::string::npos;
		lg = O.find( 'l') != std::string::npos;
		tran = tf.size() > 0;

		// Various checks
		if( mel & bark)
			std::cout << "Mel and bark at the same time?  I'll use bark then ..." << std::endl;
		if( max_f > sr/2){
			std::cout << "Maximum frequency (" << max_f << "Hz) more than sr/2 (" << sr/2 << "Hz), clipping to Nyquist instead" << std::endl;
			max_f = sr/2;
		}

		// Default output is the spectrogram so start with that output size
		o = sz/2+1;

		// Make a hann window
		w.resize( sz);
		for( int i = 0 ; i < sz ; i++)
			w(i) = .5 + .5 * std::cos( -M_PI + 2.*M_PI*T(i)/sz);

		// Setup the FFT
		fx.resize( 2*(sz/2+2));
#ifdef __FFTW
	#ifdef __FLOAT
		fft = fftwf_plan_dft_r2c_1d( sz, &fx(0), (fftwf_complex*)&fx(0), FFTW_ESTIMATE);
	#else
		fft = fftw_plan_dft_r2c_1d( sz, &fx(0), (fftw_complex*)&fx(0), FFTW_ESTIMATE);
	#endif
#else
		int bs = 0;
	#ifdef __FLOAT
		ippsFFTInitAlloc_R_32f( &FFTSpec, int(log2(double(sz))), IPP_FFT_NODIV_BY_ANY, ippAlgHintFast);
		ippsFFTGetBufSize_R_32f( FFTSpec, &bs);
		ftb.resize( bs);
	#else
		ippsFFTInitAlloc_R_64f( &FFTSpec, int(log2(double(sz))), IPP_FFT_NODIV_BY_ANY, ippAlgHintFast);
		ippsFFTGetBufSize_R_64f( FFTSpec, &bs);
		ftb.resize( bs);
	#endif
#endif

		// Center frequencies for warping
		array<T> fc;

		// Mel warping frequencies
		if( mel){
			if( min_f > 0){
				fc.resize( nf+1);
				T mn_f = Hz2mel( min_f);
				T mx_f = Hz2mel( max_f);
				for( int i = 0 ; i < nf ; i++)
					fc(i+1) = mel2Hz( mn_f + (mx_f-mn_f) * T(i)/(nf-1));
				fc(0) = 0;
			}else{
				fc.resize( nf);
				T mn_f = Hz2mel( min_f);
				T mx_f = Hz2mel( max_f);
				for( int i = 0 ; i < nf ; i++)
					fc(i) = mel2Hz( mn_f + (mx_f-mn_f) * T(i)/(nf-1));
			}
		}

		// Bark warping frequencies
		if( bark){
			// Find Barks inside our range
			int b1 = 0, b2 = 24;
			while( Bark_freq[b1] < min_f && b1 < 23) b1++;
			while( Bark_freq[b2-1] > max_f && b2-1 != 0) b2--;

			// Copy the list
			fc.resize( b2-b1+1);
			for( int i = 0 ; i < fc.size()-1 ; i++)
				fc(i+1) = Bark_freq[b1+i];
			fc(0) = 0;
			nf = fc.size()-1;
		}

		// Make the warping matrix
		if( mel | bark){
			// Convert center frequencies to bin numbers
			for( int i = 0 ; i < fc.size() ; i++)
				fc(i) = sz*fc(i)/sr;

			// Figure out the warping
			W.resize( sz/2+1, nf-1);
			for( int i = 1 ; i < fc.size()-1 ; i++){
				T a1 = 1./(fc(i)-fc(i-1)), b1 =  fc(i-1)/(fc(i-1)-fc(i));
				T a2 = 1./(fc(i)-fc(i+1)), b2 = -fc(i+1)/(fc(i)-fc(i+1));
				for( int j = 0 ; j < sz/2+1 ; j++){
					T as = a1*(j+1)+b1, ds = a2*(j+1)+b2; // why the j+1?  am i off by one? DC?
					as = (as > 1 || as < 0) ? 0 : as;
					ds = (ds > 1 || ds < 0) ? 0 : ds;
					W(j,i-1) = 2*(as + ds);
				}
			}
			nf--; // I'm skipping the last filter, what's its bandwidth?
			o = W.n;
		}

		// Load the transformation data
		if( tran){
			std::ifstream f( tf.c_str(), std::ios::in | std::ios::binary);
			int wm, wn;
			f.read( (char*)&wm, sizeof( int));
			f.read( (char*)&wn, sizeof( int));
			Tt.resize( wm, wn);
			f.read( (char*)Tt.v, Tt.size()*sizeof( T));
			Tm.resize( wm);
			f.read( (char*)Tm.v, Tm.size()*sizeof( T));
			o = Tt.n;
		}

		// Make the DCT transform
		if( dct){
			DCT.resize( b-!zero, nf);
			for( int i = !zero ; i < b ; i++)
				for( int j = 0 ; j < nf ; j++)
					DCT(i-!zero,j) = std::sqrt( 2./nf) * std::cos( (M_PI/nf) * (j+.5) * (i));
			if( zero)
				for( int j = 0 ; j < nf ; j++)
					DCT(0,j) /= std::sqrt( 2.); // that's what matlab returns for a dct ...
			o = DCT.m;
		}

		// Make the delta filter flags and constants
		if( delta){
			od = 4;
			o = 2*o;
		}else
			od = 0;

		// Setup the buffer for the delay filter and init it
		buf.resize( o, 2*od+1);
		for( int i = 0 ; i < buf.size() ; i++)
			buf(i) = 0;
		bc = 0;
		cf = od;
	}

	// Extract features from an input, if using delta features it imposes a delay of 4 frames
	T extract( array<T> &x, array<T> &y, bool use_buf = true)
	{
		using namespace std;
#ifdef __CHECK
		// Check sizes
		if( x.size() != sz)
			throw std::runtime_error( "audfeat_t::extract(): Input array size more than transform size");
#endif
		// Apply the window
		for( int i = 0 ; i < sz ; i++)
			fx(i) = w(i) * x(i) + 1e-6;

		// Do the FFT
#ifdef __FFTW
	#ifdef __FLOAT
		fftwf_execute( fft);
	#else
		fftw_execute( fft);
	#endif
#else
	#ifdef __FLOAT
		ippsFFTFwd_RToCCS_32f_I( fx.v, FFTSpec, ftb.v);
	#else
		ippsFFTFwd_RToCCS_64f_I( fx.v, FFTSpec, ftb.v);
	#endif
#endif

		// Take the magnitude
		for( int i = 0 ; i < sz/2+1 ; i++)
			fx(i) = sqrt( fx(2*i)*fx(2*i) + fx(2*i+1)*fx(2*i+1));
		
		// Normalize if asked to
		if( nrm){
			T sm = FLT_EPSILON;
			for( int i = 0 ; i < sz/2+1 ; i++)
				sm += fx(i);
			for( int i = 0 ; i < sz/2+1 ; i++)
				fx(i) /= sm;
		}

		// Take the log if asked to
		if( lg)
			for( int i = 0 ; i < sz/2+1 ; i++)
				fx(i) = log( fx(i) + FLT_EPSILON);

		// Warp according to mapping
		array<T> t;
		if( mel | bark){
			t.resize( W.n);
			for( int i = 0 ; i < W.n ; i++){
				T tt = 0;
				for( int j = 0 ; j < W.m ; j++)
					tt += W(j,i)*fx(j);
				t(i) = log( tt + FLT_EPSILON);
			}
		}else if( tran){
			t.resize( Tt.n);
			for( int i = 0 ; i < Tt.n ; i++){
				T tt = 0;
				for( int j = 0 ; j < Tt.m ; j++)
					tt += Tt(j,i)*(fx(j)-Tm(j));
				t(i) = tt;
			}
		}else{
			t.resize( sz/2+1);
			for( int i = 0 ; i < t.size() ; i++)
				t(i) = fx(i);
		}

		// DCT it
		array<T> t2;
		if( dct){
			t2.resize( DCT.m);
			for( int i = 0 ; i < DCT.m ; i++){
				T tt = 0;
				for( int j = 0 ; j < DCT.n ; j++)
					tt += DCT(i,j)*t(j);
				t2(i) = tt;
			}
		}else{
			t2.resize( t.size());
			for( int i = 0 ; i < t.size() ; i++)
				t2(i) = t(i);
		}

		// Get input window's energy
		T sm = 0;
		for( int i = 0 ; i < x.size() ; i++)
			sm += fabs( x(i));
		sm = sm/x.size();

		// Hack to avoid NaNs/Infs
		if( sm == 0)
			for( int i = 0 ; i < t2.size() ; i++)
				t2(i) = 0;

		if( use_buf){
			// Add to buffer
			for( int i = 0 ; i < t2.size() ; i++){
				if( delta){
					buf(t2.size()+i,cf) = 0;

					// Filter to get deltas
					for( int j = -od ; j <= od ; j++)
						buf(t2.size()+i,cf) += j*buf(i,cmod(cf+j,buf.n))/60;
				}
				buf(i,bc) = t2(i);
			}

			// Copy result to output
			y.resize( o);
			for( int i = 0 ; i < y.size() ; i++)
				y(i) = 0;
			for( int i = 0 ; i < buf.m ; i++)
				y(i) = buf(i,cf);

			// Update buffer counters
			bc = ++bc % buf.n;
			cf = ++cf % buf.n;

		}else{
			// Don't use buffer (or deltas)
			y.resize( t2.size());
			for( int i = 0 ; i < y.size() ; i++)
				y(i) = t2(i);
		}

		// Return frame energy
		return sm;
	}

	// Extract features from an input, do it offline with no delta delay
	void extract_offline( const array<T> &x, int hp, array<T> &y, array<T> &e)
	{
		int to = 0;
		y.resize( o, (x.size()-sz)/hp+1);
		e.resize( (x.size()-sz)/hp+1);
		int ri = 0;
		for( int i = 0 ; i < x.size()-sz ; i+= hp, ri++){
			// Make temps
			array<T> tx( x.v+i, sz), ty;//( y.v+ri*o, o);

			// Get non-delta features
			e(ri) = extract( tx, ty, false);
			to = ty.size();
			for( int j = 0 ; j < to ; j++)
				y(j,ri) = ty(j);
		}

		// Compute the deltas if needed
		if( delta)
			for( int i = 0 ; i < y.n ; i++)
				for( int k = 0 ; k < to ; k++){
					y(to+k,i) = 0;
					for( int j = -od ; j <= od ; j++)
						y(to+k,i) += j*y(k,std::min( std::max( 0, i+j), y.n-1))/60;
				}
	}
};

#endif
