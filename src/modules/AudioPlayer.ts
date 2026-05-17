import PlaybackEngine from "osmd-audio-player";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { PlayMode } from "../types";

/**
 * Forces every Instrument in the score to use General-MIDI program 0
 * (Acoustic Grand Piano). Must be called BEFORE `engine.loadScore(osmd)`
 * so the engine's `loadInstruments()` loads the piano soundfont and
 * `initInstruments()` copies program 0 onto each Voice's midiInstrumentId.
 *
 * Why mutate the score (vs. swapping after load):
 *  - osmd-audio-player's `loadInstruments()` reads `Instrument.MidiInstrumentId`
 *    to decide which SoundFont to fetch. If we leave brass/strings/etc. on
 *    the original IDs, the engine downloads those soundfonts for nothing,
 *    then `initInstruments()` writes the (non-piano) IDs onto each Voice's
 *    `midiInstrumentId` — which is what `notePlaybackCallback` later reads
 *    to pick the playback instrument.
 *  - Setting `Instrument.MidiInstrumentId` on OSMD delegates to
 *    `subInstruments[0].midiInstrumentID` (verified in opensheetmusicdisplay.min.js).
 *    That's the SubInstrument the engine consults via
 *    `note.ParentVoiceEntry.ParentVoice.Parent.SubInstruments[0]`.
 */
function forceAllToPiano(osmd: OpenSheetMusicDisplay): void {
  const PIANO = 0; // General MIDI: Acoustic Grand Piano
  const instruments = osmd.Sheet?.Instruments ?? [];
  for (const inst of instruments) {
    inst.MidiInstrumentId = PIANO;
    // Also nuke per-SubInstrument IDs defensively, in case a future engine
    // version (or a different soundfont path) ever reads beyond [0].
    // Property name is `midiInstrumentID` (capital ID) in OSMD types.
    for (const sub of inst.SubInstruments) {
      sub.midiInstrumentID = PIANO;
    }
  }
}

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
  // Silent <audio> element kept playing in the background to flip the iOS
  // audio session out of "ambient" (silenced by the ring/silent switch) and
  // into "playback" (audible even in silent mode). See unlockSilentMode().
  private silentAudio?: HTMLAudioElement;

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

    // Kick off the silent-mode unlock synchronously inside the user gesture.
    // We don't await before creating the engine — `audio.play()` happens
    // synchronously here, and the gesture token is consumed at that point.
    // The promise itself can resolve later.
    const silentUnlockPromise = this.unlockSilentMode();

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
      // Surface unlock errors (already logged inside) and avoid unhandled-rejection.
      await silentUnlockPromise;
      return;
    }

    // First call: create the engine (which creates the AudioContext) and load the score.
    this.engine = new PlaybackEngine();
    // Kick off resume() synchronously inside the gesture, before any other awaits.
    const ac = this.getAudioContext();
    const resumePromise = ac && ac.state === "suspended" ? ac.resume() : Promise.resolve();

    this.loadPromise = (async () => {
      // Override every part's MIDI program to Piano (0) BEFORE loadScore so
      // the engine fetches the piano soundfont and propagates piano to each
      // Voice. See forceAllToPiano() comment for the rationale.
      forceAllToPiano(this.osmd!);
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
    // Surface unlock errors (already logged inside) and avoid unhandled-rejection.
    await silentUnlockPromise;
  }

  /**
   * Best-effort workaround for iOS Safari's silent switch: by default
   * a WebAudio AudioContext is treated as "ambient" audio, meaning the
   * mute switch silences it. Briefly starting an HTMLAudioElement with
   * a real (but silent) audio source promotes the page's audio session
   * to "playback" mode, which keeps the AudioContext audible even when
   * the device is in silent mode.
   *
   * Caveats:
   *  - MUST be called inside a user gesture (we hook this into ensureAudio,
   *    which `PlayerView.bindEvents` triggers from the Play button handler).
   *  - Best-effort: behavior depends on iOS/Safari version. If the play()
   *    rejects we swallow the error — playback still works, just not in
   *    silent mode.
   *  - We keep `silentAudio` alive (looping, volume 0) for the lifetime of
   *    the AudioPlayer; pausing it can revert the session category.
   */
  private async unlockSilentMode(): Promise<void> {
    if (this.silentAudio) return;
    // Minimal valid silent MP3 as data URI (~1KB). Decoded by Safari/iOS.
    const SILENT_MP3 =
      "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isJUpvPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqo=";
    const audio = new Audio(SILENT_MP3);
    audio.loop = true;
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    audio.muted = false;
    audio.volume = 0;
    try {
      await audio.play();
      this.silentAudio = audio;
    } catch (err) {
      // Common on desktop (no user-gesture / autoplay restrictions) and
      // harmless — the rest of playback still works.
      console.warn("Silent-mode unlock failed (may still be muted in iOS silent mode)", err);
    }
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
    // Tear down the silent-mode unlock audio: pausing and clearing the src
    // releases the resource and lets the page audio session relax.
    if (this.silentAudio) {
      this.silentAudio.pause();
      this.silentAudio.src = "";
      this.silentAudio = undefined;
    }
    this.engine = null;
    this.osmd = null;
  }
}
