/**
 * The whistle, as measured curves rather than as a recording.
 *
 * Extracted from a real referee whistle: band-passed to the 2400-3400Hz region
 * that holds 98.3% of its energy, then the analytic signal's instantaneous
 * amplitude and frequency taken frame by frame. Because the sound is very nearly
 * a pure tone — spectral flatness 0.0014 — one oscillator following these two
 * curves reproduces it closely.
 *
 * Four parametric attempts failed first, and the curves show why. They were built
 * on a chop depth of 0.99, taken from the min and max of a MEAN-REMOVED envelope,
 * which is a meaningless figure. The real whistle holds around 0.79 of peak with a
 * handful of deep irregular dips: texture, not gating. A 95% square chop turned a
 * whistle into a buzz.
 *
 * Two adjustments to taste, applied to the contour rather than by hand:
 *   - the time axis is compressed x1.48, taking the rattle from 18Hz to 35Hz
 *     without altering its shape;
 *   - it is lengthened from 520ms to 700ms by tiling a 74ms slice of steady
 *     rattle 5 times, mirroring alternate copies so it does not repeat exactly;
 *   - the onset is bent up 15%, decaying with a 200ms time constant, so the blast
 *     starts sharp at 3261Hz and tapers onto the measured contour. This one is NOT in
 *     the recording, whose pitch merely wanders; it is there because a real blast
 *     starts sharp and settles as breath pressure falls.
 *
 * The loop boundaries are chosen to MATCH in amplitude, not to be quiet: the pair
 * here sits at 0.620 and 0.619, a step of 0.0001. A matched join is what avoids a
 * discontinuity; picking the deepest dips instead leaves a step if they differ.
 *
 * On measuring the rattle, since it was got wrong twice: read it from the STEADY
 * portion with the mean removed. The whole contour gives the overall envelope and
 * autocorrelation locks onto a harmonic; neither is the rattle.
 *
 * Frequency is held at its last confident reading through the quiet moments,
 * where the tone is too faint to measure and the estimate is noise.
 *
 * Nothing here is hand-tuned. Regenerate with gen_whistle.py, whose only knobs
 * are RATTLE and TARGET_MS.
 */
export const WHISTLE_DURATION_MS = 700

/** Amplitude, 0-1 of peak, every 3ms. */
export const WHISTLE_AMPLITUDE: readonly number[] = [
  0.02, 0.032, 0.047, 0.061, 0.033, 0.01, 0.078, 0.234, 0.33, 0.485, 0.535, 0.527,
  0.395, 0.816, 0.81, 0.887, 0.935, 0.888, 0.821, 0.873, 0.832, 0.789, 0.947, 0.883,
  0.879, 0.726, 0.894, 0.897, 0.709, 0.895, 0.836, 0.845, 0.857, 0.962, 0.604, 0.839,
  0.865, 0.865, 0.958, 0.881, 0.866, 0.792, 0.879, 0.902, 0.857, 0.622, 0.933, 0.956,
  0.802, 0.873, 0.769, 0.848, 0.873, 0.86, 0.63, 0.885, 0.935, 0.876, 0.608, 0.915,
  0.925, 0.73, 0.847, 0.866, 0.71, 0.813, 0.774, 0.843, 0.831, 0.942, 0.852, 0.584,
  0.856, 0.769, 0.726, 0.85, 0.799, 0.806, 0.863, 0.87, 0.883, 0.783, 0.898, 0.885,
  0.691, 0.824, 0.823, 0.927, 0.698, 0.82, 0.97, 0.853, 0.908, 0.827, 0.999, 0.84,
  0.821, 0.814, 0.752, 0.714, 0.866, 0.803, 0.76, 0.816, 0.852, 0.779, 0.83, 0.943,
  0.863, 0.746, 0.862, 0.803, 0.863, 0.886, 0.785, 0.96, 0.831, 0.761, 0.793, 0.816,
  0.904, 0.955, 0.628, 0.934, 0.926, 0.751, 0.827, 0.825, 0.768, 0.722, 0.957, 0.926,
  0.832, 0.855, 0.871, 0.811, 0.761, 0.919, 0.916, 0.725, 0.813, 0.833, 0.637, 0.833,
  0.811, 0.721, 0.916, 0.916, 0.761, 0.813, 0.869, 0.856, 0.832, 0.927, 0.958, 0.721,
  0.765, 0.826, 0.825, 0.751, 0.922, 0.938, 0.62, 0.953, 0.904, 0.814, 0.797, 0.768,
  0.832, 0.961, 0.783, 0.882, 0.867, 0.801, 0.86, 0.743, 0.865, 0.944, 0.828, 0.782,
  0.852, 0.816, 0.759, 0.801, 0.865, 0.716, 0.752, 0.815, 0.813, 0.84, 1, 0.828,
  0.836, 0.974, 0.855, 0.648, 0.844, 0.761, 0.731, 0.85, 0.791, 0.78, 0.847, 0.864,
  0.855, 0.794, 0.927, 0.887, 0.696, 0.66, 0.789, 0.636, 0.516, 0.211, 0.098, 0.046,
  0.015, 0.021, 0.054, 0.023, 0.072, 0.033, 0.053, 0.054, 0.043, 0.034, 0.089, 0.076,
  0.046, 0.107, 0.063, 0.014, 0.067, 0,
]

/** Frequency in Hz, every 12ms. */
export const WHISTLE_FREQUENCY: readonly number[] = [
  3261, 3236, 2943, 2880, 3157, 3170, 3058, 3070, 3179, 3112, 3031, 3049,
  3097, 3108, 3090, 2971, 2927, 2947, 3063, 2961, 2877, 2910, 2861, 2809,
  2891, 2991, 2945, 2869, 2823, 2875, 2986, 2995, 2907, 2863, 2854, 2957,
  2862, 2838, 2906, 2950, 2969, 2965, 2907, 2853, 2874, 2947, 2907, 2760,
  2867, 2937, 2817, 2765, 2839, 2532, 2632, 2631, 2630, 2629, 2629,
]
