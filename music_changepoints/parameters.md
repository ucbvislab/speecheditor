# Potential variables:

## Feature
*   RMS energy
*   MFCCs
*   Chroma features
*   Log of magnitude of FFT (as per original novelty paper; freq > Fs/4 are discarded)

## K (kernel size)
*   32 (1.6 seconds on each side)
*   64 (3.2 seconds on each side)
*   128 (6.4 seconds on each side)

64 generally seems to work well.

## Smoothing parameter
The size of our hamming window when we're smoothing the kernel response before peak-finding. Right now we're using 33.

## Window length
It seems like we'd be ok sticking with 100ms.

## Distance metric
*   Euclidean (RMS energy, MFCCs, chroma)
*   Cosine distance (MFCCs, chroma)
*   KL divergence, EMD (if we model MFCCs with a GMM)