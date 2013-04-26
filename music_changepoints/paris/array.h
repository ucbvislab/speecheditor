// array.h -- A multidimensional array class
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


#ifndef __ARRAY_H__
#define __ARRAY_H__

#include <iostream>
#include <stdexcept>

//
// Multidimensional array class
// 

template <class T>
class array{
public:
	T *v;
	int m, n, k;
	bool alias;

	// Construct/destruct array
	inline array() : v(NULL), m(0), n(0), k(0), alias( false) {}
	inline array( int _m, int _n = 1, int _k = 1) 
	 : v(NULL), m(_m), n(_n), k(_k), alias(false) { if( m*n*k) v = new T[m*n*k]; else v = NULL;}
	inline array( T *p, int M, int N = 1, int K = 1) : v(p), m(M), n(N), k(K), alias(true) {}
	inline array( const array<T> &b) : v(NULL), m(b.m), n(b.n), k(b.k), alias(false)
	{
		try{
			v = new T[m*n*k];
		}
		catch( std::bad_alloc &){
			throw std::runtime_error( "array::array(): Error allocating memory");
		}
		for( int i = 0 ; i < m*n*k ; i++)
			v[i] = b(i);
	}
	inline ~array() { if( v && !alias) delete [] v;}

	// Assign
	inline array<T> &operator=( const array<T> &b)
	{
		resize( b.m, b.n, b.k);
		for( int i = 0 ; i < m*n*k ; i++)
			v[i] = b(i);
		return *this;
	}

	// Triple index addressing
	inline T &operator()( int i1, int i2, int i3)
	{
#ifdef __CHECK
		if( i1+i2*m+i3*(m*n) > m*n*k)
			throw std::runtime_error( "array::operator()(i1,i2,i3): Index out of bounds");
#endif
		return v[i1+i2*m+i3*(m*n)];
	}

	inline T operator()( int i1, int i2, int i3) const
	{
#ifdef __CHECK
		if( i1+i2*m+i3*(m*n) > m*n*k)
			throw std::runtime_error( "array::operator()(i1,i2,i3): Index out of bounds");
#endif
		return v[i1+i2*m+i3*(m*n)];
	}

	// Double index addressing
	inline T &operator()( int i1, int i2)
	{
#ifdef __CHECK
		if( i1+i2*m > m*n*k)
			throw std::runtime_error( "array::operator()(i1,i2): Index out of bounds");
#endif
		return v[i1+i2*m];
	}

	inline T operator()( int i1, int i2) const
	{
#ifdef __CHECK
		if( i1+i2*m > m*n*k)
			throw std::runtime_error( "array::operator()(i1,i2): Index out of bounds");
#endif
		return v[i1+i2*m];
	}

	// Single index addressing
	inline T &operator()( int i1)
	{
#ifdef __CHECK
		if( i1 > m*n*k)
			throw std::runtime_error( "array::operator()(i1): Index out of bounds");
#endif
		return v[i1];
	}

	inline T operator()( int i1) const
	{
#ifdef __CHECK
		if( i1 > m*n*k)
			throw std::runtime_error( "array::operator()(i1): Index out of bounds");
#endif
		return v[i1];
	}

	// Resize array
	inline void resize( int i1, int i2 = 1, int i3 = 1)
	{
		if( m != i1 || n != i2 || k != i3){
			if( alias)
				throw std::runtime_error( "array::resize(): Cannot resize alias array");
			m = i1; n = i2; k = i3;
			if( v != NULL) delete [] v;
			try{
				v = new T[m*n*k];
			}
			catch( std::bad_alloc &){
				throw std::runtime_error( "array::resize(): Error allocating memory");
			}
		}
	}

	// Append an element at the end of the vector
	inline void push_back( T a)
	{
		if( m != size() && n != size() && k != size() && size() > 0)
			throw std::runtime_error( "array::push_back(): Can't push back in a non-vector");			
		try{
			T *v2 = new T[m*n*k+1];
			for( int i = 0 ; i < m*n*k ; i++){
				v2[i] = v[i];
			}
			delete [] v;
			v = v2;
			if( size() == 0) m = n = k = 1;
			else if( m == size()) m++;
			else if( n == size()) n++;
			else if( k == size()) k++;
		}
		catch( std::bad_alloc &){
			throw std::runtime_error( "array::push_back(): Error allocating memory");
		}
		v[m*n*k-1] = a;
	}

	// Overall size
	inline int size() const { return m*n*k; }

	// Convert to a pointer
//	operator T*() { return v;}
};


// ostream interface to array<T>
template <class T>
std::ostream &operator<<( std::ostream &o, const array<T> &a)
{
	// Vector
	if( a.n == 1 && a.k == 1){
		for( int i = 0 ; i < a.m ; i++)
			o << a(i) << ' ';
		o << std::endl;

	// Matrix
	}else if( a.k == 1){
		for( int i = 0 ; i < a.m ; i++){
			for( int j = 0 ; j < a.n ; j++)
				o << a(i,j) << ' ';
			o << std::endl;
		}

	// And beyond ...
	}else{
		for( int k = 0 ; k < a.k ; k++){
			for( int i = 0 ; i < a.m ; i++){
				for( int j = 0 ; j < a.n ; j++)
					o << a(i,j,k) << ' ';
				o << std::endl;
			}
			o << "------------" << std::endl;
		}
	}
	return o;
}

#endif
