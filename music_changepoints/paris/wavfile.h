// wavfile.h -- Read/write for WAV files
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


#ifndef __WAVFILE_H
#define __WAVFILE_H

#ifdef _WINDOWS
#pragma warning (disable:4996 4554 4244 4101)
#endif

#include <fstream>
#include <string>
#include "array.h"

class wavfile_t{
public:
	unsigned int channels;
	unsigned int frames;
	double samplerate;
	std::fstream file;
	int file_type;
	int bits;

	// Open a wave file
	wavfile_t( const std::string &fn, std::ios::openmode mode = std::ios::in, int ch = 1, double sr = 16000) 
	 : channels( ch), frames( 0), samplerate( sr), file(), file_type( 0), bits( 0)
	{
		// Open an input file
		if( mode == std::ios::in){
			file.open( fn.c_str(), std::ios::in | std::ios::binary);

			unsigned int i, r, a;
			signed short c, s, f;
			char id[4];

			// Make sure you are at the start of file
			file.seekg( 0, std::ios::beg);

			// Check if file is in WAVE format
			file.read( id, 4);
			if( memcmp( id, "RIFF", 4))
				throw std::runtime_error( "wavfile_t::wavfile_t() : File doesn't start with 'RIFF'");

			file.seekg( 4, std::ios::cur); // Skip filesize ...
			file.read( (char*)id, 4);  
			if( memcmp( id, "WAVE", 4))
				throw std::runtime_error( "wavfile_t::wavfile_t() : File doesn't have 'WAVE' id");

			// Find where fmt chunk is
			while( !file.rdstate()){
				file.read( (char*)id, 4);
				if( !memcmp( id, "fmt ", 4))
					goto fmt_code;  // Ouch a goto!
				file.read( (char*)&i, sizeof( unsigned int));
				file.seekg( i, std::ios::cur);
			}
			throw std::runtime_error( "wavfile_t::wavfile_t() : Could not locate 'fmt ' chunk");

		fmt_code:

			// Get important parameters
			file.read( (char*)&i, sizeof( unsigned int));
			file.read( (char*)&f, sizeof( signed short));
			file.read( (char*)&c, sizeof( signed short));
			file.read( (char*)&r, sizeof( unsigned int));
			file.read( (char*)&a, sizeof( unsigned int));
			file.seekg( 2, std::ios::cur); // Skip junk parameter
			file.read( (char*)&s, sizeof( signed short));
			channels = c;
			samplerate = r;
			bits = s;

			// Get sample format
			if( f > 1 & (s != 16 & s != 8 & s != 32))
				throw std::runtime_error( "wavfile_t::wavfile_t() : WAVE file isn't PCM float, 16-bit or 8-bit, can't read that format");

			// Move to first sample
			file.seekg( i-16, std::ios::cur);
			while( !file.rdstate()){
				file.read( (char*)id, 4);
				if( !memcmp( id, "data", 4))
					goto data_code;  // Ouch another one!
				file.read( (char*)&i, sizeof( unsigned int));
				file.seekg( i, std::ios::cur);
			}
			throw std::runtime_error( "wavfile_t::wavfile_t() : Could not locate 'data' chunk");

		data_code:
			// Read number of samples
			file.read( (char*)&frames, sizeof( unsigned int));
			frames = frames / (bits/8) / channels;

			file_type = 1;

		// Open an output file
		}else if( mode == std::ios::out){
			file.open( fn.c_str(), std::ios::out | std::ios::binary);
			unsigned int i, s;

			// Write all the header info
			file.write( "RIFF", 4);
			i = 0; file.write( (char*)&i, 4); // file size, write in the end
			file.write( "WAVE", 4);
			file.write( "fmt ", 4);
			i = 16; file.write( (char*)&i, 4); // chunk length
			s = 1; file.write( (char*)&s, 2); // PCM 
			file.write( (char*)&channels, 2); // channels
			i = samplerate; file.write( (char*)&i, 4); // sample rate
			i = samplerate*2*channels; file.write( (char*)&i, 4); // bytes per second
			s = 2*channels; file.write( (char*)&s, 2); // bytes per frame
			s = 16; file.write( (char*)&s, 2); // bits per sample

			// Start with the data chunk
			file.write( "data", 4);
			i = 0; file.write( (char*)&i, 4); // number of sample bytes, write in the end

			file_type = 2;
		}
	}

	~wavfile_t()
	{
		// Write out the sizes
		if( file_type == 2){
			file.seekp( 0, std::ios::end);
			unsigned int i = file.tellp();
			i -= 4;
			file.seekp( 4, std::ios::beg);
			file.write( (char*)&i, 4);
			file.seekp( 40, std::ios::beg);
			i -= 8+24+8;
			file.write( (char*)&i, 4);
		}
	}

	// Read a mono buffer from the file
	template <class T>
	void read_mono( array<T> &p)
	{
		// This is a write file
		if( file_type == 2)
			throw std::runtime_error( "wavfile_t::read_mono(): Can't read from a write file");

		// Read the first channel only
		if( bits == 16){
			short s[16];
			for( int i = 0 ; i < p.size() & !file.eof() ; i++){
				file.read( (char*)s, channels*sizeof( short));
				p(i) = double( s[0])/32768.;
			}
		}else if( bits == 8){
			signed char s[16];
			for( int i = 0 ; i < p.size() & !file.eof() ; i++){
				file.read( (char*)s, channels*sizeof( char));
				p(i) = double( s[0])/128.;
			}
		}else if( bits == 32){
			float s[16];
			for( int i = 0 ; i < p.size() & !file.eof() ; i++){
				file.read( (char*)s, channels*sizeof( float));
				p(i) = double( s[0]);
			}
		}
	}
    
	// Read a stereo buffer from the file
	template <class T>
	void read_stereo ( array<T> &p, array<T> &q)
	{
		// This is a write file
		if( file_type == 2)
			throw std::runtime_error( "wavfile_t::read_mono(): Can't read from a write file");

		// Read the first channel only
		if( bits == 16){
			short s[16];
			for( int i = 0 ; i < p.size() && !file.eof() ; i++){
				file.read( (char*)s, channels*sizeof( short));
				p(i) = T( s[0]/32768.);
                q(i) = T( s[1]/32768.);
			}
		}else if( bits == 8){
			signed char s[16];
			for( int i = 0 ; i < p.size() && !file.eof() ; i++){
				file.read( (char*)s, channels*sizeof( char));
				p(i) = T( s[0]/128.);
                q(i) = T( s[1]/128.);
			}
		}else if( bits == 32){
			float s[16];
			for( int i = 0 ; i < p.size() && !file.eof() ; i++){
				file.read( (char*)s, channels*sizeof( float));
				p(i) = T( s[0]);
                q(i) = T( s[1]);
			}
		}
        // doesn't read 24 bit files
	}

	// Write a buffer to the file
	template <class T>
	void write( const array<T> &p)
	{
		for( int i = 0 ; i < p.size() ; i++){
			short s = 32767*p(i);
			file.write( (char*)&s, sizeof( short));
		}
	}
};

#endif
