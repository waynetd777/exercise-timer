#!/usr/bin/env python3
"""Regenerates src/audio/whistleCurve.ts from the analysed whistle.

  RATTLE=1.32 TARGET_MS=700 python3 gen_whistle.py

Needs amp.npy / freq.npy / meta.npy, produced by the analysis pass.
"""
import os, numpy as np, pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent/'src'/'audio'/'whistleCurve.ts'

# The analysis arrays are the instantaneous amplitude and frequency of the Tabata
# app's whistle mp3, at full sample rate. They are deliberately NOT committed: at
# that resolution they are enough to resynthesise the recording, which makes them
# effectively a copy of it, and this repo is public with the app's audio purged
# from its history. The 234-point curve in whistleCurve.ts is far too coarse to be
# a copy, which is why THAT is what ships.
ANALYSIS = pathlib.Path(os.environ.get('ANALYSIS_DIR', HERE/'.analysis'))

# Defaults ARE the shipped sound: a bare `python3 scripts/gen_whistle.py` must
# reproduce src/audio/whistleCurve.ts exactly. Bumped as each nudge is accepted,
# so no one has to remember a set of env vars to regenerate what is committed.
RATTLE = float(os.environ.get('RATTLE', 1.48))
TARGET_MS = int(os.environ.get('TARGET_MS', 700))
SOURCE_MS, AMP_STEP_MS, FREQ_STEP_MS, MIN_SLICE_MS = 520, 3, 12, 60
MIRROR = os.environ.get('MIRROR', '1') == '1'
# The onset pitch bend. The measured contour does NOT have one: it wanders between
# 2516 and 2929Hz with only a mild -218Hz net drift, no initial-high-then-taper
# shape. So this is a deliberate departure from the recording, added because a hard
# blast starts sharp and settles as breath pressure falls. BEND is the fractional
# rise at the very start, BEND_TAU_MS how quickly it decays back to the measurement.
BEND = float(os.environ.get('BEND', 0.15))
BEND_TAU_MS = float(os.environ.get('BEND_TAU_MS', 200))

try:
    amp = np.load(ANALYSIS/'amp.npy'); freq = np.load(ANALYSIS/'freq.npy')
    sr = int(np.load(ANALYSIS/'meta.npy')[0])
except FileNotFoundError:
    raise SystemExit(
        f"No analysis arrays in {ANALYSIS}.\n"
        "They are derived from a local copy of the Tabata app's whistle and are not\n"
        "committed (see the note at the top of this file). Point ANALYSIS_DIR at the\n"
        "directory holding amp.npy / freq.npy / meta.npy, or re-run the analysis pass\n"
        "against sound_whistle_01.mp3 to rebuild them.")
end = min(int(sr*SOURCE_MS/1000), len(amp))
amp, freq = amp[:end], freq[:end]

good = amp > amp.max()*0.15
last = float(np.median(freq[good]))
held = np.empty_like(freq)
for i in range(len(freq)):
    if good[i] and 2300 < freq[i] < 3600: last = float(freq[i])
    held[i] = last

def smooth(s, ms):
    w = max(1, int(sr*ms/1000))
    return np.convolve(np.pad(s, w, mode='edge'), np.ones(w)/w, mode='same')[w:-w] if w > 1 else s

amp_s, freq_s = smooth(amp, 1.0), smooth(held, 8.0)

def bounds(a):
    p = int(np.argmax(a)); return p + int(sr*0.02), len(a) - int(sr*0.070)

# A peak-COUNTING rattle measure was tried here twice and removed both times. It
# counts sub-cycle structure: on the untouched source, whose rattle is 18Hz, it
# reported 115Hz unsmoothed and still 48Hz smoothed with a 12ms separation guard,
# because one rattle cycle has a rounded top with several local maxima. Proper
# prominence criteria would be needed. The FFT below is validated instead by the
# fact that it tracks RATTLE proportionally: x1.18 -> 20.7Hz, x1.32 -> 24.4Hz,
# x1.48 -> 27.8Hz, all within a bin of 18 x RATTLE.
def rattle_hz(a, from_ms=None, to_ms=None):
    """Dominant modulation rate of the steady portion, mean removed.

    Measured on a window long enough to resolve it: a ~130ms slice cannot tell
    18Hz from 24Hz, which is how a compressed curve was once reported as having
    SLOWED. The final tiled curve is both long enough and the thing actually
    heard, so that is what gets measured.
    """
    lo, hi = bounds(a) if from_ms is None else (int(sr*from_ms/1000), int(sr*to_ms/1000))
    d = a[lo:hi] - a[lo:hi].mean()
    if len(d) < int(sr*0.25):
        return float('nan')      # too short to trust; say so rather than guess
    sp = np.abs(np.fft.rfft(d*np.hanning(len(d)))); fr = np.fft.rfftfreq(len(d), 1/sr)
    m = (fr >= 8) & (fr <= 60); return float(fr[m][np.argmax(sp[m])])

# The source recording's rattle. Its steady portion is only ~167ms, too short for
# the FFT above to resolve confidently, so this is the figure two independent
# methods agreed on when analysing the raw file: FFT 18.0Hz, autocorrelation
# 17.5Hz. Stated rather than re-derived, so the generator cannot report a nan.
SOURCE_RATTLE_HZ = 18.0
before = SOURCE_RATTLE_HZ
n = int(len(amp_s)/RATTLE); t = np.linspace(0, len(amp_s)-1, n)
amp_c = np.interp(t, np.arange(len(amp_s)), amp_s)
freq_c = np.interp(t, np.arange(len(freq_s)), freq_s)
# `after` is measured below, once the curve has been tiled to full length.

lo, hi = bounds(amp_c); win = int(sr*0.004)
mins = [i for i in range(lo+win, hi-win) if amp_c[i] == amp_c[i-win:i+win].min()]
min_slice = int(sr*MIN_SLICE_MS/1000)
pairs = [(abs(amp_c[i]-amp_c[j]), i, j)
         for k, i in enumerate(mins) for j in mins[k+1:] if j - i >= min_slice]
if not pairs: raise SystemExit(f"no loop pair with a {MIN_SLICE_MS}ms slice; lower MIN_SLICE_MS")

# Prefer the LONGEST slice whose ends still match, not the single best match.
# A short slice repeated many times is exactly periodic, and exact periodicity is
# what makes a tiled rattle sound mechanical rather than fast. Any join under
# JOIN_TOLERANCE is inaudible, so spend the slack on covering more distinct
# rattle cycles per repeat.
JOIN_TOLERANCE = 0.01
matched = [pr for pr in pairs if pr[0] <= JOIN_TOLERANCE]
step, a0, a1 = max(matched, key=lambda pr: pr[2] - pr[1]) if matched else min(pairs)

need = int(sr*TARGET_MS/1000) - len(amp_c)
sl_a, sl_f = amp_c[a0:a1], freq_c[a0:a1]
reps = max(1, int(np.ceil(need/len(sl_a)))) if need > 0 else 0
if need > 0:
    # Alternate forward and reversed copies. Because the slice was cut between two
    # amplitude-MATCHED minima, its two ends sit at the same level, so a reversed
    # copy joins just as smoothly as a forward one in either direction. The result
    # repeats every 2 slices instead of every 1, and the rattle's own asymmetry
    # stops the ear locking onto a period.
    flip = lambda x, i: x if (not MIRROR or i % 2 == 0) else x[::-1]
    copies = [flip(sl_a, i) for i in range(reps)]
    fcopies = [flip(sl_f, i) for i in range(reps)]
    fill_a, fill_f = np.concatenate(copies)[:need], np.concatenate(fcopies)[:need]
    amp_out = np.concatenate([amp_c[:a1], fill_a, amp_c[a1:]])
    freq_out = np.concatenate([freq_c[:a1], fill_f, freq_c[a1:]])
else:
    amp_out, freq_out = amp_c, freq_c
# Exponential glide down onto the measured contour, applied multiplicatively so the
# contour's own texture rides on top of the bend instead of being flattened by it.
if BEND:
    ms = np.arange(len(freq_out))/sr*1000
    freq_out = freq_out*(1 + BEND*np.exp(-ms/BEND_TAU_MS))

duration_ms = int(round(len(amp_out)/sr*1000))
after = rattle_hz(amp_out)

def resample(s, ms): return s[np.arange(0, len(s), int(sr*ms/1000))]
a = np.clip(resample(amp_out, AMP_STEP_MS), 0, None); a = a/a.max(); a[-1] = 0.0
f = resample(freq_out, FREQ_STEP_MS)

def fmt(v, places, per):
    out, line = [], []
    for x in v:
        line.append(f"{x:.{places}f}".rstrip('0').rstrip('.') if places else f"{x:.0f}")
        if len(line) == per: out.append('  ' + ', '.join(line) + ','); line = []
    if line: out.append('  ' + ', '.join(line) + ',')
    return '\n'.join(out)

ts = f'''/**
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
 *   - the time axis is compressed x{RATTLE}, taking the rattle from {before:.0f}Hz to {after:.0f}Hz
 *     without altering its shape;
 *   - it is lengthened from {SOURCE_MS}ms to {duration_ms}ms by tiling a {len(sl_a)/sr*1000:.0f}ms slice of steady
 *     rattle {reps} times, mirroring alternate copies so it does not repeat exactly;
 *   - the onset is bent up {BEND*100:.0f}%, decaying with a {BEND_TAU_MS:.0f}ms time constant, so the blast
 *     starts sharp at {f[0]:.0f}Hz and tapers onto the measured contour. This one is NOT in
 *     the recording, whose pitch merely wanders; it is there because a real blast
 *     starts sharp and settles as breath pressure falls.
 *
 * The loop boundaries are chosen to MATCH in amplitude, not to be quiet: the pair
 * here sits at {amp_c[a0]:.3f} and {amp_c[a1]:.3f}, a step of {step:.4f}. A matched join is what avoids a
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
export const WHISTLE_DURATION_MS = {duration_ms}

/** Amplitude, 0-1 of peak, every {AMP_STEP_MS}ms. */
export const WHISTLE_AMPLITUDE: readonly number[] = [
{fmt(a, 3, 12)}
]

/** Frequency in Hz, every {FREQ_STEP_MS}ms. */
export const WHISTLE_FREQUENCY: readonly number[] = [
{fmt(f, 0, 12)}
]
'''
OUT.write_text(ts)
print(f"rattle {before:.1f} -> {after:.1f} Hz | pitch {f[0]:.0f} -> {f[len(f)//2]:.0f} -> {f[-1]:.0f} Hz | duration {duration_ms}ms | "
      f"loop {len(sl_a)/sr*1000:.0f}ms x{reps}, join step {step:.4f} | "
      f"{len(a)} amp / {len(f)} freq points")
