/**
 * Tiny UI sounds, synthesized with Web Audio — no audio files to ship.
 */
const KEY = 'folium:sounds';
let ctx: AudioContext | null = null;

export type Sound = 'tick' | 'pop' | 'thunk';

const VOICES: Record<
  Sound,
  { from: number; to: number; duration: number; wave: OscillatorType; gain: number }
> = {
  tick: { from: 1900, to: 1300, duration: 0.045, wave: 'triangle', gain: 0.035 },
  pop: { from: 480, to: 920, duration: 0.09, wave: 'sine', gain: 0.06 },
  thunk: { from: 190, to: 70, duration: 0.14, wave: 'sine', gain: 0.1 },
};

export function soundsEnabled(): boolean {
  return localStorage.getItem(KEY) !== 'off';
}

export function setSoundsEnabled(on: boolean): void {
  localStorage.setItem(KEY, on ? 'on' : 'off');
}

export function play(sound: Sound): void {
  if (!soundsEnabled()) return;
  try {
    ctx ??= new AudioContext();
    const voice = VOICES[sound];
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(voice.from, t);
    osc.frequency.exponentialRampToValueAtTime(voice.to, t + voice.duration);
    gain.gain.setValueAtTime(voice.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + voice.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + voice.duration + 0.02);
  } catch {
    // Audio is a nicety; ignore browsers that block it.
  }
}
