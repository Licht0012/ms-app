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
 *   load, ensureAudio, play, pause, stop, applyPlayMode, setTempo.
 *
 * Notes on the underlying library (v0.7.0):
 *  - Entry point default-exports `PlaybackEngine`.
 *  - `loadScore(osmd)` internally wires `osmd.cursor` — no separate listener call.
 *  - Per-voice volume is read from `Voice.Volume` at note-scheduling time;
 *    we mutate each voice's `Volume` directly. `Instrument.Volume` is not
 *    consulted by the playback engine.
 *  - `setBpm(bpm)` updates playback tempo.
 *  - `stop()` is async (returns Promise) but we expose it as fire-and-forget
 *    to match the planned synchronous signature.
 *
 * iOS Safari note:
 *  - PlaybackEngine's constructor creates (and immediately suspends) an
 *    AudioContext. On iOS Safari, an AudioContext created outside a user
 *    gesture, or whose `resume()` is not called within a user gesture,
 *    stays silent. To stay safe we defer instantiating PlaybackEngine
 *    until the first user-gesture call to `ensureAudio()`, and we make
 *    `ensureAudio()` synchronously initiate a `resume()` so it can be
 *    awaited from inside a tap handler.
 */
export class AudioPlayer {
  private engine: PlaybackEngine | null = null;
  private osmd: OpenSheetMusicDisplay | null = null;
  // Pending state to apply once the engine exists.
  private pendingTempo: number | null = null;
  private pendingPlayMode: {
    mode: PlayMode;
    selectedPartIndex: number;
    totalParts: number;
  } | null = null;
  // Cache of the `loadScore` promise so a second `ensureAudio()` while the
  // first is still resolving doesn't kick off a duplicate load.
  private loadPromise: Promise<void> | null = null;

  constructor() {
    // Intentionally empty — engine creation is deferred until ensureAudio()
    // so the underlying AudioContext is created inside a user gesture.
  }

  /**
   * Stores the parsed score. The engine itself is not created here so that
   * the AudioContext can be created later, inside a user gesture.
   */
  async load(osmd: OpenSheetMusicDisplay): Promise<void> {
    if (!osmd.Sheet) throw new Error("OSMD sheet not loaded");
    this.osmd = osmd;
  }

  /**
   * Lazily creates the PlaybackEngine and loads the score. MUST be called
   * inside a user-gesture handler on iOS Safari so the AudioContext is
   * created/resumed under that gesture.
   *
   * Idempotent: subsequent calls just resume the AudioContext if needed.
   */
  async ensureAudio(): Promise<void> {
    if (!this.osmd) throw new Error("AudioPlayer: load() must be called before ensureAudio()");

    if (this.engine) {
      // Engine already exists — just make sure the underlying AC is running.
      // We poke into the engine to grab the AC. Since PlaybackEngine.play()
      // already does `await this.ac.resume()`, the engine itself handles
      // resume on its own — but doing it here too is harmless and gives us
      // a synchronous resume() invocation directly inside the user gesture.
      const ac = this.getAudioContext();
      if (ac && ac.state === "suspended") {
        try {
          await ac.resume();
        } catch (err) {
          console.warn("AudioContext resume failed", err);
        }
      }
      // Wait for any in-flight loadScore.
      if (this.loadPromise) await this.loadPromise;
      return;
    }

    // First call: create the engine (which creates the AudioContext) and load the score.
    this.engine = new PlaybackEngine();
    // Kick off resume() synchronously inside the gesture, before any other awaits.
    const ac = this.getAudioContext();
    const resumePromise = ac && ac.state === "suspended" ? ac.resume() : Promise.resolve();

    this.loadPromise = (async () => {
      // osmd-audio-player ships with its own (older) opensheetmusicdisplay
      // typings nested under node_modules; the runtime objects are
      // structurally compatible but TypeScript sees two nominally distinct
      // declarations. Bridge through `unknown` rather than `any` — the engine
      // only reads `Sheet` and `cursor`, both present in both versions.
      await this.engine!.loadScore(
        this.osmd as unknown as Parameters<PlaybackEngine["loadScore"]>[0],
      );
      // Apply any settings that arrived before the engine existed.
      if (this.pendingTempo !== null) {
        this.engine!.setBpm(this.pendingTempo);
        this.pendingTempo = null;
      }
      if (this.pendingPlayMode) {
        const { mode, selectedPartIndex, totalParts } = this.pendingPlayMode;
        this.applyPlayMode(mode, selectedPartIndex, totalParts);
        this.pendingPlayMode = null;
      }
    })();

    try {
      await resumePromise;
    } catch (err) {
      console.warn("AudioContext resume failed", err);
    }
    await this.loadPromise;
  }

  /**
   * Returns the underlying AudioContext if available. We reach into the
   * engine's private `ac` field — kept as a small abstraction so callers
   * don't depend on the private name.
   */
  private getAudioContext(): AudioContext | null {
    if (!this.engine) return null;
    // The PlaybackEngine stores its AudioContext on a private `ac` field
    // (see node_modules/osmd-audio-player/dist/PlaybackEngine.js line 32).
    // standardized-audio-context's AudioContext is API-compatible with the
    // native AudioContext for our purposes (state, resume()).
    const ac = (this.engine as unknown as { ac: AudioContext }).ac;
    return ac ?? null;
  }

  async play(): Promise<void> {
    // Ensure the engine exists (and AC is resumed) before playing.
    // This is safe to call repeatedly.
    await this.ensureAudio();
    if (!this.engine || !this.engine.ready) return;
    await this.engine.play();
  }

  pause(): void {
    if (!this.engine?.ready) return;
    this.engine.pause();
  }

  stop(): void {
    if (!this.engine?.ready) return;
    void this.engine.stop();
  }

  /**
   * Adjusts per-part volume according to the play mode.
   *
   * Takes effect for notes scheduled after this call; in-flight notes within the
   * audio scheduler's lookahead (~100ms) continue at their previous gain. Callers
   * that need an immediate switch should pause() and play() to flush the buffer.
   */
  applyPlayMode(
    mode: PlayMode,
    selectedPartIndex: number,
    totalParts: number,
  ): void {
    if (!this.engine?.ready || !this.osmd?.Sheet) {
      // Engine not ready yet — remember and apply once loadScore resolves.
      this.pendingPlayMode = { mode, selectedPartIndex, totalParts };
      return;
    }
    const { selected, others } = VOLUME_PROFILES[mode];
    const instruments = this.osmd.Sheet.Instruments;
    for (let i = 0; i < totalParts; i++) {
      const inst = instruments[i];
      if (!inst) continue;
      const volume = i === selectedPartIndex ? selected : others;
      for (const voice of inst.Voices) {
        voice.Volume = volume;
      }
    }
  }

  setTempo(bpm: number): void {
    if (!this.engine?.ready) {
      this.pendingTempo = bpm;
      return;
    }
    this.engine.setBpm(bpm);
  }

  dispose(): void {
    // PlaybackEngine (v0.7.0) has no dispose method — stop() is the
    // only available teardown hook for clearing scheduled audio.
    if (this.engine?.ready) {
      void this.engine.stop();
    }
    this.engine = null;
    this.osmd = null;
  }
}
