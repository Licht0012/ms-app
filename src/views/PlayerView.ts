import { ScoreRenderer } from "../modules/ScoreRenderer";
import { AudioPlayer } from "../modules/AudioPlayer";
import type { LibraryStore } from "../modules/LibraryStore";
import type { ScoreRecord, PlayMode, DisplayMode } from "../types";
import { escapeHtml } from "../utils/html";

type Callbacks = {
  onBack: () => void;
};

type State = {
  selectedPartIndex: number;
  playMode: PlayMode;
  displayMode: DisplayMode;
  isPlaying: boolean;
};

export class PlayerView {
  private readonly store: LibraryStore;
  private readonly scoreId: string;
  private readonly callbacks: Callbacks;
  private renderer?: ScoreRenderer;
  private player?: AudioPlayer;
  private record?: ScoreRecord;
  private state: State = {
    selectedPartIndex: 0,
    playMode: "emphasize",
    displayMode: "all",
    isPlaying: false,
  };

  constructor(store: LibraryStore, scoreId: string, callbacks: Callbacks) {
    this.store = store;
    this.scoreId = scoreId;
    this.callbacks = callbacks;
  }

  async render(root: HTMLElement, isCurrent?: () => boolean): Promise<void> {
    const record = await this.store.get(this.scoreId);
    if (isCurrent && !isCurrent()) return;
    if (!record) {
      root.innerHTML = `<p class="error">楽譜が見つかりません</p>`;
      return;
    }
    this.record = record;

    // Restore last state if present
    if (record.lastState) {
      this.state.selectedPartIndex = record.lastState.selectedPartIndex;
      this.state.playMode = record.lastState.playMode;
      this.state.displayMode = record.lastState.displayMode;
    }

    root.innerHTML = `
      <header class="app-header">
        <button class="icon-btn" data-action="back" aria-label="戻る">←</button>
        <h1>${escapeHtml(record.title)}</h1>
        <span class="spacer"></span>
      </header>
      <div class="score-container" id="score-container"></div>
      <div class="controls">
        <div class="parts">
          ${record.parts.map((p) => `
            <button class="part-chip ${p.index === this.state.selectedPartIndex ? "active" : ""}"
                    data-part-index="${p.index}">${escapeHtml(p.name)}</button>
          `).join("")}
        </div>
        <div class="mode-row">
          <label><input type="radio" name="mode" value="emphasize" ${this.state.playMode === "emphasize" ? "checked" : ""}/> 強調</label>
          <label><input type="radio" name="mode" value="solo" ${this.state.playMode === "solo" ? "checked" : ""}/> ソロ</label>
          <label><input type="radio" name="mode" value="minusOne" ${this.state.playMode === "minusOne" ? "checked" : ""}/> マイナスワン</label>
        </div>
        <div class="display-row">
          表示:
          <select data-action="display-mode">
            <option value="all" ${this.state.displayMode === "all" ? "selected" : ""}>全パート</option>
            <option value="selectedOnly" ${this.state.displayMode === "selectedOnly" ? "selected" : ""}>選択パートのみ</option>
          </select>
        </div>
        <div class="transport">
          <button data-action="play" class="play-btn" aria-label="再生">▶</button>
          <button data-action="stop" aria-label="停止">■</button>
        </div>
      </div>
    `;

    if (isCurrent && !isCurrent()) return;

    // Init renderer & player
    const scoreContainer = root.querySelector<HTMLDivElement>("#score-container")!;
    this.renderer = new ScoreRenderer(scoreContainer);
    try {
      await this.renderer.load(record.xmlContent);
    } catch (err) {
      console.error("Score load failed", err);
      scoreContainer.innerHTML = `<p class="error">楽譜の描画に失敗しました：${escapeHtml((err as Error).message)}</p>`;
      return;
    }
    if (isCurrent && !isCurrent()) return;

    this.renderer.setDisplayMode(this.state.displayMode, this.state.selectedPartIndex);

    if (record.lastState && record.lastState.cursorMeasure > 0) {
      this.renderer.goToMeasure(record.lastState.cursorMeasure);
    }

    this.player = new AudioPlayer();
    try {
      await this.player.load(this.renderer.getOsmd());
    } catch (err) {
      console.error("Audio init failed", err);
    }
    if (isCurrent && !isCurrent()) return;

    this.player.applyPlayMode(this.state.playMode, this.state.selectedPartIndex, record.parts.length);

    this.bindEvents(root);
    await this.store.setLastOpened(this.scoreId);
  }

  private bindEvents(root: HTMLElement): void {
    root.querySelector("[data-action=back]")?.addEventListener("click", () => {
      this.callbacks.onBack();
    });

    root.querySelectorAll<HTMLButtonElement>(".part-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.state.selectedPartIndex = parseInt(btn.dataset.partIndex!, 10);
        root.querySelectorAll(".part-chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.applyState();
        void this.persist();
      });
    });

    root.querySelectorAll<HTMLInputElement>("input[name=mode]").forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          this.state.playMode = radio.value as PlayMode;
          this.applyState();
          void this.persist();
        }
      });
    });

    root.querySelector<HTMLSelectElement>("[data-action=display-mode]")?.addEventListener("change", (e) => {
      this.state.displayMode = (e.target as HTMLSelectElement).value as DisplayMode;
      this.renderer?.setDisplayMode(this.state.displayMode, this.state.selectedPartIndex);
      void this.persist();
    });

    const playBtn = root.querySelector<HTMLButtonElement>("[data-action=play]");
    let playInFlight = false;
    playBtn?.addEventListener("click", async () => {
      if (playInFlight) return;
      if (this.state.isPlaying) {
        this.player?.pause();
        this.state.isPlaying = false;
        playBtn.textContent = "▶";
        return;
      }
      // Optimistic UI before await — prevents double-tap re-entry while play() resolves.
      this.state.isPlaying = true;
      playBtn.textContent = "⏸";
      playInFlight = true;
      try {
        await this.player?.play();
      } catch (err) {
        console.error("play failed", err);
        this.state.isPlaying = false;
        playBtn.textContent = "▶";
      } finally {
        playInFlight = false;
      }
    });

    root.querySelector("[data-action=stop]")?.addEventListener("click", () => {
      this.player?.stop();
      this.state.isPlaying = false;
      if (playBtn) playBtn.textContent = "▶";
    });
  }

  private applyState(): void {
    if (!this.record) return;
    this.player?.applyPlayMode(this.state.playMode, this.state.selectedPartIndex, this.record.parts.length);
    this.renderer?.setDisplayMode(this.state.displayMode, this.state.selectedPartIndex);
  }

  private async persist(): Promise<void> {
    if (!this.record) return;
    await this.store.updateLastState(this.scoreId, {
      selectedPartIndex: this.state.selectedPartIndex,
      playMode: this.state.playMode,
      displayMode: this.state.displayMode,
      cursorMeasure: this.renderer?.getCurrentMeasureIndex() ?? 0,
      tempo: this.record.lastState?.tempo ?? 120,
    });
  }

  dispose(): void {
    this.player?.dispose();
    this.player = undefined;
    this.renderer?.dispose();
    this.renderer = undefined;
  }
}
