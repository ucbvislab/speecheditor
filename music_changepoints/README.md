# music-changepoints

`novelty` is a program to find interesting changes in music. Run it on a wav file, and it will return several points (in seconds) of interesting changes in the song, based on either RMS energy (volume changes), MFCCs (timbral changes), or chroma features (harmonic changes).

------------------------------------------------------------------------------

To compile on OS X:

`g++ -O2 -lfftw3 -framework accelerate novelty.cpp -o novelty`

To run:

`./novelty <PATH TO WAV FILE> <(int) KERNEL SIZE> <FEATURE> <DISTANCE METRIC> <(int) MAX RESULTS>`
    
and change points will be printed. You can also run

`./novelty <PATH TO WAV FILE> rms`
    
`./novelty <PATH TO WAV FILE> mfcc`
    
or

`./novelty <PATH TO WAV FILE> chroma`
    
to find the changepoints with rms, mfcc, or chroma as the feature with all other settings set to their respective defaults.
    
Or call any of the functions:

    double* findChangepointsRMS (string filename);
    double* findChangepointsMFCC (string filename);
    double* findChangepointsChroma (string filename);
    double* findChangepoints (string filename, NoveltySettings ns);


Each version has default k = 64, nres = 5. 

RMS version of the function has feature = "rms", dist = "euc".

MFCC version of the function has feature = "mfcc", dist = "cos".

Chroma version of the function has features = "chroma", dist = "euc".

Each function returns an array of change points (in seconds) of length `nres`.

The NoveltySettings struct has the form:
    
    struct NoveltySettings {
        int k;
        string feature;
        string dist;
        int nres;
    };
    

### Supported sample rates
8000, 16000, 22050, 32000, 44100, 48000, 96000.

It's trivial to add new supported sample rates (see `novelty.cpp` line 593), and it would only be a small amount of code messiness to support all sample rates (with faster, templatized rates specified like the above rates).

## Explanation of parameters

### Path to wav file

Right now the code is designed for wave files sampled at 44.1 kHz. To convert mp3s to wave files of this format, you can run

`lame --decode song.mp3` or `ffmpeg -i song.mp3 song.wav`

Of course, you can also use Adobe Media Encoder.

### Kernel size

The kernel size is how long the algorithm is "looking" on each side of a potential change point, in jumps of 50 ms. For example: a kernel size of 64 means we're looking 64 * 50 ms = 3.2 seconds before and 3.2 seconds after each point to gauge the change.

The value you choose here should depend on what kind of change points you're trying to find. If you're trying to find really fine-grained changes, try a small value. If you're trying to find major differences between sections, try a large value. In general, `64` seems to be a good size.

### Feature

The feature options right now are: `rms`, `mfcc`, and `chroma`.

* `rms`: find change points based on RMS energy (essentially volume) of the music. This tends to be the first feature I try for every song, and for my purposes it works best. It'll find big downbeats, etc.
* `mfcc`: find change points based on MFCCs, a feature that measures the timbre of music. This will find changes in how the music "sounds."
* `chroma`: find change points based on chroma vectors, a feature that encodes harmonics of music.

Important note: if you choose `mfcc` or `chroma`, realize that the change points go from "less exciting" to "more exciting" sections of the music. However, we only return RMS energy change points when they are points going from "less exciting" to "more exciting" as measured by change in RMS energy.

We'll hopefully add a mode that lets you specify a convex combination of all three features.

### Distance metric

Options are `euc` (Euclidean) and `cos` (cosine similarity).

For `rms`, it must be `euc`. For `mfcc` and `chroma` it can be either. I think that `cos` works better for `mfcc` and `euc` works better for `chroma`. For this argument doesn't matter (it's hard-coded).

### Max results

We'll return this many change points.

## Front end interface

Navigate to `/frontend` and run 

`python novelty-server.py`

(requires web.py, scikits.audiolab, PIL, and numpy)

Then open your browser and visit `localhost:8080`. You must have an mp3 version of each song in `frontend/static/songs/mp3` and a wav of each song in `frontend/static/songs/wav`.

## Sanity checks

In `tests/` run `python generate_points.py` and then `python create_test_underlays.py`. You can then listen to the results (in `tests/underlays/`). Modify `generate_points.py` to change how the music change points are found.

