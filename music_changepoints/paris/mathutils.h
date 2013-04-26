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

#ifndef MATHUTILS_H
#define MATHUTILS_H

#include <cmath>
#include <cfloat>
#include <algorithm>

#ifndef M_PI
	#define M_PI (4.*atan(1.))
#endif

#ifdef _WINDOWS
	inline float log2( float x) { return log(x)/log(2.f); }
	inline double log2( double x) { return log(x)/log(2.); }
	inline float round( float x) { return (x-floor(x)) > 0.5f ? ceil(x) : floor(x); }
	inline double round( double x) { return (x-floor(x)) > 0.5 ? ceil(x) : floor(x); }
	inline float log1p( float x) {return log( 1.f+x);}
	inline double log1p( double x) {return log( 1.+x);}
	inline float isnan( float x) { return (x)!=(x); };
	inline double isnan( double x) { return (x)!=(x); };
	inline float isinf( float x) { return (!isnan( x) && isnan(x-x)); };
	inline double isinf( double x) { return (!isnan( x) && isnan(x-x)); };

	#define NEG_INF (-1e38)
#else
	#define NEG_INF (-HUGE_VAL)
#endif


// A constistent random number generator for cross-platform tests
int _random_m_w = 123;
int _random_m_z = 321;

inline int my_rand()
{
	_random_m_z = 36969 * (_random_m_z & 65535) + (_random_m_z >> 16);
	_random_m_w = 18000 * (_random_m_w & 65535) + (_random_m_w >> 16);
	return std::abs( (_random_m_z << 16) + _random_m_w);  // 0 to 2147483646 (~2^31)
}

#endif
