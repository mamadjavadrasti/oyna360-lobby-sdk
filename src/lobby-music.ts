/**
 * Lobby audio: background theme + movement SFX (Web Audio).
 * Browsers only allow playback after a user gesture inside this frame.
 */
export class LobbyMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private step = 0;
  private timer: number | null = null;
  private muted = false;
  private musicStarted = false;
  private skipAutoStart = false;
  private unlocking = false;
  private readonly onGesture = () => {
    void this.unlock(true);
  };

  constructor() {
    window.addEventListener('pointerdown', this.onGesture, true);
    window.addEventListener('keydown', this.onGesture, true);
    window.addEventListener('touchstart', this.onGesture, { capture: true, passive: true });
  }

  /** Call from the music button so the same click does not start then immediately mute. */
  noteUserToggled() {
    this.skipAutoStart = true;
  }

  async unlock(autoStartMusic = false) {
    if (this.unlocking) return;
    this.unlocking = true;
    try {
      await this.ensureContext();
      if (autoStartMusic && !this.skipAutoStart) await this.startMusic();
    } finally {
      this.unlocking = false;
    }
  }

  async startMusic() {
    this.muted = false;
    this.applyMusicGain();
    await this.ensureContext();
    if (this.musicStarted) return;
    this.musicStarted = true;
    this.tick();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMusicGain();
  }

  /** @returns true when music is muted after the toggle */
  toggleMuted() {
    if (!this.musicStarted || this.muted) {
      this.muted = false;
      this.applyMusicGain();
      void this.startMusic();
      return false;
    }
    this.setMuted(true);
    return true;
  }

  isMuted() {
    return this.muted;
  }

  playStep(running: boolean) {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    this.thump(ctx, dest, running ? 92 : 78, t, running ? 0.07 : 0.09, running ? 0.28 : 0.22);
    this.noiseBurst(ctx, dest, t, running ? 0.045 : 0.06, running ? 0.16 : 0.12, running ? 520 : 380);
  }

  playJump() {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    this.sweep(ctx, dest, 220, 480, t, 0.16, 0.2);
    this.noiseBurst(ctx, dest, t, 0.08, 0.14, 900);
  }

  playLand(impact = 6) {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const hard = Math.min(1, Math.max(0.35, impact / 12));
    this.thump(ctx, dest, 64, t, 0.12, 0.34 * hard);
    this.noiseBurst(ctx, dest, t, 0.07, 0.18 * hard, 240);
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onGesture, true);
    window.removeEventListener('keydown', this.onGesture, true);
    window.removeEventListener('touchstart', this.onGesture, true);
    if (this.timer != null) window.clearTimeout(this.timer);
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
  }

  private async ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.85;
      this.sfxBus.connect(this.master);
      this.applyMusicGain();
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* still locked */
      }
    }
  }

  private applyMusicGain() {
    if (!this.musicBus || !this.ctx) return;
    const vol = this.muted || !this.musicStarted ? 0 : 0.42;
    this.musicBus.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.04);
  }

  private tick = () => {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || ctx.state !== 'running') {
      this.timer = window.setTimeout(this.tick, 200);
      void this.ensureContext();
      return;
    }

    const bpm = 92;
    const beat = 60 / bpm;
    const t0 = ctx.currentTime + 0.05;
    const bar = this.step % 8;

    const roots = [261.63, 196, 220, 174.61, 261.63, 196, 174.61, 220];
    const thirds = [329.63, 246.94, 261.63, 220, 329.63, 246.94, 220, 261.63];
    const fifths = [392, 293.66, 329.63, 261.63, 392, 293.66, 261.63, 329.63];
    const bass = [130.81, 98, 110, 87.31, 130.81, 98, 87.31, 110];
    const lead = [
      [523.25, 0],
      [587.33, 0.5],
      [659.25, 1],
      [587.33, 1.5],
      [523.25, 2],
      [392, 3],
      [440, 4],
      [523.25, 5],
      [493.88, 6],
      [440, 6.5],
      [392, 7],
    ];

    this.thump(ctx, bus, 52, t0, 0.09, 0.2);
    this.tone(ctx, bus, bass[bar], t0, beat * 1.85, 'triangle', 0.38);
    this.tone(ctx, bus, roots[bar], t0, beat * 1.8, 'sine', 0.16);
    this.tone(ctx, bus, thirds[bar], t0 + 0.02, beat * 1.7, 'sine', 0.12);
    this.tone(ctx, bus, fifths[bar], t0 + 0.04, beat * 1.6, 'sine', 0.09);

    for (const [freq, at] of lead) {
      if (Math.floor(at) === bar) {
        this.tone(ctx, bus, freq, t0 + (at % 1) * beat, beat * 0.55, 'triangle', 0.14);
      }
    }

    this.step += 1;
    this.timer = window.setTimeout(this.tick, beat * 1000);
  };

  private tone(
    ctx: AudioContext,
    dest: GainNode,
    freq: number,
    time: number,
    dur: number,
    type: OscillatorType,
    vol: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private thump(ctx: AudioContext, dest: GainNode, freq: number, time: number, dur: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, time + dur);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private sweep(ctx: AudioContext, dest: GainNode, from: number, to: number, time: number, dur: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + dur);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private noiseBurst(ctx: AudioContext, dest: GainNode, time: number, dur: number, vol: number, freq: number) {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  private makeNoise(ctx: AudioContext) {
    const length = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
