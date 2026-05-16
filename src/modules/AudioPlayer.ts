import PlaybackEngine from "osmd-audio-player";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { PlayMode } from "../types";

/**
 * Per-part gain profile for each play mode.
 * Values map to the 0..1 gain scale that osmd-audio-player applies via
 * `Voice.Volume` (read in PlaybackEngine.notePlaybackCallback).
 */
const VOLUME_PROFILES: Record<PlayMode, { selected: number; others: number }> = {
  emphasize: { selected: 1.0, others: 0.3 },
  solo: { selected: 1.0, others: 0.0 },
  minusOne: { selected: 0.0, others: 1.0 },
};

/**
 * Thin wrapper around osmd-audio-player's `PlaybackEngine`.
 *
 * Exposed surface — keep stable for `PlayerView` consumers:
 *   load, play, pause, stop, applyPlayMode, setTempo.
 *
 * Notes on the underlying library (v0.7.0):
 *  - Entry point default-exports `PlaybackEngine`.
 *  - `loadScore(osmd)` internally wires `osmd.cursor` — no separate listener call.
 *  - Per-voice volume is read from `Voice.Volume` at note-scheduling time,
 *    so we set both `Instrument.Volume` and `Voice.Volume` to be robust.
 *  - `setBpm(bpm)` updates playback tempo.
 *  - `stop()` is async (returns Promise) but we expose it as fire-and-forget
 *    to match the planned synchronous signature.
 */
export class AudioPlayer {
  private engine: PlaybackEngine;
  private osmd: OpenSheetMusicDisplay | null = null;

  constructor() {
    this.engine = new PlaybackEngine();
  }

  async load(osmd: OpenSheetMusicDisplay): Promise<void> {
    if (!osmd.Sheet) throw new Error("OSMD sheet not loaded");
    this.osmd = osmd;
    // osmd-audio-player ships with its own (older) opensheetmusicdisplay
    // typings nested under node_modules; the runtime objects are
    // structurally compatible but TypeScript sees two nominally distinct
    // declarations. Bridge through `unknown` rather than `any` — the engine
    // only reads `Sheet` and `cursor`, both present in both versions.
    await this.engine.loadScore(
      osmd as unknown as Parameters<PlaybackEngine["loadScore"]>[0],
    );
  }

  async play(): Promise<void> {
    if (!this.engine.ready) return;
    await this.engine.play();
  }

  pause(): void {
    if (!this.engine.ready) return;
    this.engine.pause();
  }

  stop(): void {
    if (!this.engine.ready) return;
    void this.engine.stop();
  }

  applyPlayMode(
    mode: PlayMode,
    selectedPartIndex: number,
    totalParts: number,
  ): void {
    if (!this.engine.ready || !this.osmd?.Sheet) return;
    const { selected, others } = VOLUME_PROFILES[mode];
    const instruments = this.osmd.Sheet.Instruments;
    for (let i = 0; i < totalParts; i++) {
      const inst = instruments[i];
      if (!inst) continue;
      const volume = i === selectedPartIndex ? selected : others;
      inst.Volume = volume;
      for (const voice of inst.Voices) {
        voice.Volume = volume;
      }
    }
  }

  setTempo(bpm: number): void {
    if (!this.engine.ready) return;
    this.engine.setBpm(bpm);
  }
}
