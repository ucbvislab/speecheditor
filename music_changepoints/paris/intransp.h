// intransp.h -- In-place matrix transposition
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


#ifndef __INTRANSP_H__
#define __INTRANSP_H__

// In-place transposition
template <class T>
void intp( T *a, int m, int n)
{
	// Allocate temp memory
	int iwrk = (m+n)/2;
	int *move = new int[iwrk];

	int mn = m*n;
	T b, c, d;
	int i, k, i1, i2, im, i1c, i2c, ir0, ir1, ir2, kmi, mx, ncount;

	// Parameter adjustments
	--a;
	--move;

	ncount = 2;
	k = mn - 1;
	for( i = 1; i <= iwrk ; ++i)
		move[i] = 0;

	if( m < 3 || n < 3)
		goto L30;

	// CALCULATE THE NUMBER OF FIXED POINTS, EUCLIDS ALGORITHM FOR GCD(M-1,N-1).
	ir2 = m - 1;
	ir1 = n - 1;
L20:
	ir0 = ir2 % ir1;
	ir2 = ir1;
	ir1 = ir0;
	if( ir0 != 0)
		goto L20;
	ncount = ncount + ir2 - 1;

	// SET INITIAL VALUES FOR SEARCH
L30:
	i = 1;
	im = m;
	// AT LEAST ONE LOOP MUST BE RE-ARRANGED
	goto L80;

	// SEARCH FOR LOOPS TO REARRANGE
L40:
	mx = k - i;
	++i;
	if( i > mx)
		return;
	im += m;
	if( im > k)
		im -= k;
	i2 = im;
	if( i == i2)
		goto L40;
	if( i > iwrk)
		goto L60;
	if( move[i] == 0)
		goto L80;
	goto L40;
L50:
	i2 = m * i1 - k * (i1 / n);
L60:
	if( i2 <= i || i2 >= mx)
		goto L70;
	i1 = i2;
	goto L50;
L70:
	if( i2 != i)
		goto L40;

// REARRANGE THE ELEMENTS OF A LOOP AND ITS COMPANION LOOP
L80:
	i1 = i;
	kmi = k - i;
	b = a[i1 + 1];
	i1c = kmi;
	c = a[i1c + 1];
L90:
	i2 = m * i1 - k * (i1 / n);
	i2c = k - i2;
	if( i1 <= iwrk)
		move[i1] = 2;
	if( i1c <= iwrk)
		move[i1c] = 2;
	ncount += 2;
	if( i2 == i)
		goto L110;
	if( i2 == kmi)
		goto L100;
	a[i1 + 1] = a[i2 + 1];
	a[i1c + 1] = a[i2c + 1];
	i1 = i2;
	i1c = i2c;
	goto L90;

// FINAL STORE AND TEST FOR FINISHED
L100:
	d = b;
	b = c;
	c = d;
L110:
	a[i1 + 1] = b;
	a[i1c + 1] = c;
	if( ncount < mn)
		goto L40;
}

#endif
