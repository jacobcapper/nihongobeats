import { Judgment } from '../types/game';

const PENTATONIC_HZ = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392, 440];

export class AudioEngine {
  readonly ctx: AudioContext;
  private master: GainNode;
  private bpm = 120;
  private gameStartTime = 0; // AudioContext time at which count-in beat 1 starts
  private songStartTime = 0; // AudioContext time at which chart beat 1 hits
  private scheduledUpTo = 0;
  private schedulerHandle: ReturnType<typeof setInterval> | null = null;
  private arpStep = 0;
  private readonly LOOKAHEAD = 0.4; // seconds
  private readonly TICK_MS = 80;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.65;
    this.master.connect(this.ctx.destination);
  }

  get currentMs(): number {
    return Math.max(0, (this.ctx.currentTime - this.gameStartTime) * 1000);
  }

  async start(bpm: number, leadInBeats = 4): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.bpm = bpm;
    const beatS = 60 / bpm;

    // Count-in starts 100ms from now so the scheduler has headroom
    this.gameStartTime = this.ctx.currentTime + 0.1;
    this.songStartTime = this.gameStartTime + leadInBeats * beatS;

    // Schedule metronome click for count-in
    for (let i = 0; i < leadInBeats; i++) {
      const t = this.gameStartTime + i * beatS;
      this.click(t, i === 0 ? 1320 : 880, i === 0 ? 0.35 : 0.22);
    }

    // Start lookahead drum + arp scheduler from song beat 1
    this.scheduledUpTo = this.songStartTime;
    this.arpStep = 0;
    this.schedulerHandle = setInterval(() => this.schedule(), this.TICK_MS);
    this.schedule();
  }

  stop() {
    if (this.schedulerHandle !== null) {
      clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }

  playHit(judgment: Judgment) {
    const now = this.ctx.currentTime;
    switch (judgment) {
      case 'PERFECT':
        this.sine(1320, 0.07, now, 0.22);
        this.sine(1760, 0.05, now + 0.015, 0.14);
        break;
      case 'GREAT':
        this.sine(880, 0.07, now, 0.18);
        break;
      case 'GOOD':
        this.sine(660, 0.07, now, 0.12);
        break;
      case 'MISS':
        this.noise(0.05, now, 0.09);
        break;
    }
  }

  // ── Private scheduling ────────────────────────────────────────────────────

  private schedule() {
    const beatS = 60 / this.bpm;
    const stepS = beatS / 4; // 16th note
    const until = this.ctx.currentTime + this.LOOKAHEAD;

    let t = this.scheduledUpTo;
    while (t < until) {
      const rawSteps = Math.round((t - this.songStartTime) / stepS);
      const step = ((rawSteps % 16) + 16) % 16;

      // Drum pattern
      if (step === 0 || step === 8) this.kick(t);
      if (step === 4 || step === 12) this.snare(t);
      if (step % 2 === 0) this.hihat(t, step === 10 ? 0.28 : 0.38);

      // Pentatonic arpeggio on every beat (step 0,4,8,12)
      if (step % 4 === 0) {
        const freq = PENTATONIC_HZ[this.arpStep % PENTATONIC_HZ.length];
        this.bassNote(freq, beatS * 0.45, t, 0.18);
        this.arpStep++;
      }

      t += stepS;
    }
    this.scheduledUpTo = t;
  }

  private click(when: number, freq: number, vol: number) {
    this.sine(freq, 0.04, when, vol);
  }

  private kick(when: number) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.11);
    g.gain.setValueAtTime(0.85, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.22);
  }

  private snare(when: number) {
    const buf = this.mkNoise(0.18);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 3200;
    flt.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.38, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    src.start(when);
    src.stop(when + 0.18);

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.frequency.setValueAtTime(210, when);
    osc.frequency.exponentialRampToValueAtTime(90, when + 0.05);
    og.gain.setValueAtTime(0.22, when);
    og.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
    osc.connect(og);
    og.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.08);
  }

  private hihat(when: number, vol: number) {
    const buf = this.mkNoise(0.06);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 9500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * 0.45, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.048);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    src.start(when);
    src.stop(when + 0.06);
  }

  private bassNote(freq: number, dur: number, when: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.setTargetAtTime(0.001, when + dur * 0.6, dur * 0.1);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private sine(freq: number, dur: number, when: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.01);
  }

  private noise(dur: number, when: number, vol: number) {
    const buf = this.mkNoise(dur);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(g);
    g.connect(this.master);
    src.start(when);
    src.stop(when + dur + 0.01);
  }

  private mkNoise(dur: number): AudioBuffer {
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
}
