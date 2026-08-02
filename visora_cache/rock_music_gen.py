"""Rock music generator for Shorthills AI enterprise video."""
import numpy as np
import struct, wave, os

SR = 44100
BPM = 148
BEAT = SR * 60 // BPM  # samples per beat

def sine(freq, dur, amp=0.5, sr=SR):
    t = np.linspace(0, dur, int(sr*dur), False)
    return (np.sin(2*np.pi*freq*t) * amp).astype(np.float32)

def sawtooth(freq, dur, amp=0.4, sr=SR):
    t = np.linspace(0, dur, int(sr*dur), False)
    return ((2*(t*freq - np.floor(t*freq+0.5))) * amp).astype(np.float32)

def square(freq, dur, amp=0.3, sr=SR):
    t = np.linspace(0, dur, int(sr*dur), False)
    s = np.sin(2*np.pi*freq*t)
    return (np.sign(s) * amp).astype(np.float32)

def distort(sig, gain=8.0):
    s = sig * gain
    return np.tanh(s) * 0.6

def note_buf(midi, dur, amp=0.4, kind='saw'):
    freq = 440.0 * 2**((midi-69)/12)
    if kind=='saw':
        s = sawtooth(freq, dur, amp)
    elif kind=='sq':
        s = square(freq, dur, amp)
    else:
        s = sine(freq, dur, amp)
    env = np.ones(len(s), dtype=np.float32)
    att = int(SR*0.005); rel = int(SR*0.08)
    env[:att] = np.linspace(0,1,att)
    env[-rel:] = np.linspace(1,0,rel)
    return s * env

def kick(sr=SR):
    dur = 0.4
    t = np.linspace(0, dur, int(sr*dur), False)
    freq = 160 * np.exp(-t*25)
    s = np.sin(2*np.pi*np.cumsum(freq)/sr)
    env = np.exp(-t*8)
    noise = np.random.randn(len(t)) * 0.05 * np.exp(-t*40)
    return ((s * env + noise) * 0.9).astype(np.float32)

def snare(sr=SR):
    dur = 0.2
    t = np.linspace(0, dur, int(sr*dur), False)
    tone = np.sin(2*np.pi*200*t) * np.exp(-t*30) * 0.4
    noise = np.random.randn(len(t)) * np.exp(-t*15) * 0.7
    env = np.exp(-t*12)
    return ((tone + noise) * env * 0.8).astype(np.float32)

def hihat(dur=0.06, open_=False, sr=SR):
    t = np.linspace(0, dur, int(sr*dur), False)
    noise = np.random.randn(len(t))
    # high-pass via diff
    hp = np.diff(noise, prepend=noise[0])
    d = 20 if open_ else 60
    env = np.exp(-t*d)
    return (hp * env * 0.35).astype(np.float32)

def crash(sr=SR):
    dur = 1.2
    t = np.linspace(0, dur, int(sr*dur), False)
    noise = np.random.randn(len(t))
    hp = np.diff(noise, prepend=noise[0])
    env = np.exp(-t*4)
    return (hp * env * 0.5).astype(np.float32)

def mix_at(buf, pos, sig):
    end = pos + len(sig)
    if end > len(buf): sig = sig[:len(buf)-pos]
    buf[pos:pos+len(sig)] += sig

TOTAL_BEATS = int(BPM * 60 / 60)  # 60 seconds × BPM/60 beats
TOTAL_SAMPS = SR * 62  # 62 seconds

# ── Chord progression (power chords: root + 5th) ──────────────────────────
# E minor rock: Em - C - G - D  (midi: 52, 48, 55, 50 as roots)
PROG = [
    [40, 47],  # E2 + B2  (Em power)
    [36, 43],  # C2 + G2
    [43, 50],  # G2 + D3
    [38, 45],  # D2 + A2
]

def build_track():
    mono = np.zeros(TOTAL_SAMPS, dtype=np.float32)

    beat_s = 60.0 / BPM

    # ── DRUMS ──────────────────────────────────────────────────────────────
    # 4/4 pattern: kick on 1,3; snare on 2,4; hh every 8th note
    total_beats = int(TOTAL_SAMPS / SR / beat_s)

    k = kick(); sn = snare()
    hh8 = hihat(0.05); hho = hihat(0.15, open_=True)
    cr  = crash()

    for b in range(total_beats):
        pos = int(b * beat_s * SR)
        bd = b % 4
        # kick: beats 0, 2 (and extra "and" on 2.5 for groove)
        if bd in (0, 2):
            mix_at(mono, pos, k)
        if bd == 2 and b > 4:
            pos2 = int((b + 0.5) * beat_s * SR)
            mix_at(mono, pos2, k * 0.6)
        # snare: beats 1, 3
        if bd in (1, 3):
            mix_at(mono, pos, sn)
        # hi-hat every 8th note (half beat)
        mix_at(mono, pos, hh8)
        pos_h = int((b + 0.5) * beat_s * SR)
        if bd == 1 or bd == 3:
            mix_at(mono, pos_h, hho)
        else:
            mix_at(mono, pos_h, hh8)
        # crash on bar 1
        if b % 16 == 0:
            mix_at(mono, pos, cr * (1.0 if b==0 else 0.5))

    # ── BASS ───────────────────────────────────────────────────────────────
    bar_s = beat_s * 4
    for bar in range(int(TOTAL_SAMPS / SR / bar_s)):
        chord = PROG[bar % 4]
        root = chord[0]  # already E2 range
        pos = int(bar * bar_s * SR)
        # Bass pattern: root on 1, octave-root stab on 3 & "and of 4"
        mix_at(mono, pos, distort(note_buf(root+12, beat_s*1.8, 0.5, 'saw'), 5))
        pos2 = int((bar*4 + 2) * beat_s * SR)
        mix_at(mono, pos2, distort(note_buf(root+12, beat_s*0.9, 0.4, 'saw'), 5))
        pos3 = int((bar*4 + 3.5) * beat_s * SR)
        mix_at(mono, pos3, distort(note_buf(root+12, beat_s*0.4, 0.35, 'saw'), 5))

    # ── DISTORTED GUITAR (power chords) ────────────────────────────────────
    for bar in range(int(TOTAL_SAMPS / SR / bar_s)):
        chord = PROG[bar % 4]
        pos = int(bar * bar_s * SR)
        chord_len = int(bar_s * SR)
        chord_sig = np.zeros(chord_len, dtype=np.float32)
        for note in chord:
            s1 = note_buf(note+24, bar_s*1.0, 0.25, 'saw')[:chord_len]
            s2 = note_buf(note+36, bar_s*1.0, 0.15, 'sq')[:chord_len]
            chord_sig[:len(s1)] += s1
            chord_sig[:len(s2)] += s2
        dist_chord = distort(chord_sig, 9)
        # rhythmic chug: downstroke on each beat
        for b in range(4):
            bp = int(b * beat_s * SR)
            chug_len = int(beat_s * SR * 0.85)
            if bp < len(dist_chord):
                seg = dist_chord[bp:bp+chug_len]
                mix_at(mono, pos+bp, seg)

    # ── LEAD GUITAR RIFF (E pentatonic minor) ─────────────────────────────
    # Riff only in bars 2-3, 6-7, 10-11, 14-15 (every 4 bars after first)
    RIFF_MIDI = [52, 55, 57, 59, 62, 59, 57, 55]  # E minor pentatonic run
    riff_note_dur = beat_s * 0.45
    for bar in range(int(TOTAL_SAMPS / SR / bar_s)):
        if bar % 4 not in (2, 3): continue
        pos = int(bar * bar_s * SR)
        for ni, midi in enumerate(RIFF_MIDI):
            np_ = pos + int(ni * beat_s * 0.5 * SR)
            mix_at(mono, np_, distort(note_buf(midi+12, riff_note_dur, 0.3, 'sq'), 4))

    # ── NORMALIZE ─────────────────────────────────────────────────────────
    peak = np.max(np.abs(mono))
    if peak > 0:
        mono = mono / peak * 0.88

    # stereo (simple L/R slight delay for width)
    delay_samp = int(SR * 0.012)
    left  = np.pad(mono, (0, delay_samp))[:-delay_samp]
    right = np.pad(mono, (delay_samp, 0))[delay_samp:]
    stereo = np.stack([left, right], axis=1)  # (N, 2)

    return stereo

def save_wav(path, data, sr=SR):
    pcm = (np.clip(data, -1, 1) * 32767).astype(np.int16)
    flat = pcm.flatten()
    with wave.open(path, 'w') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(flat.tobytes())

if __name__ == "__main__":
    os.makedirs("visora_cache", exist_ok=True)
    print("Generating rock track (148 BPM, Em progression)...")
    stereo = build_track()
    out = "visora_cache/rock_track.wav"
    save_wav(out, stereo)
    dur = stereo.shape[0] / SR
    mb = os.path.getsize(out) / 1e6
    print(f"✓ {out}  ({mb:.1f} MB, {dur:.1f}s)")
