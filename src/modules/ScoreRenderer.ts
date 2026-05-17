import {
  OpenSheetMusicDisplay,
  type IOSMDOptions,
} from "opensheetmusicdisplay";
import type { DisplayMode } from "../types";

export class ScoreRenderer {
  private static readonly MIN_ZOOM = 0.5;
  private static readonly MAX_ZOOM = 3.0;

  private osmd: OpenSheetMusicDisplay;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement, options: IOSMDOptions = {}) {
    this.container = container;
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: "svg",
      drawTitle: true,
      drawPartNames: true,
      ...options,
    });
  }

  async load(xml: string): Promise<void> {
    await this.osmd.load(xml);
    this.osmd.render();
    this.osmd.cursor.show();
    this.osmd.cursor.reset();
  }

  getOsmd(): OpenSheetMusicDisplay {
    return this.osmd;
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  setDisplayMode(mode: DisplayMode, selectedPartIndex: number): void {
    const instruments = this.osmd.Sheet?.Instruments ?? [];
    instruments.forEach((inst, i) => {
      inst.Visible = mode === "all" ? true : i === selectedPartIndex;
    });
    this.osmd.render();
    this.osmd.cursor.show();
  }

  goToMeasure(measureIndex: number): void {
    this.osmd.cursor.reset();
    const iterator = this.osmd.cursor.Iterator;
    // Safety counter prevents an infinite loop if the iterator never reaches
    // the target measure (e.g. malformed score). 100k voice entries is far
    // beyond any realistic music score length.
    for (
      let i = 0;
      i < 100000 &&
      !iterator.EndReached &&
      iterator.CurrentMeasureIndex < measureIndex;
      i++
    ) {
      this.osmd.cursor.next();
    }
  }

  getCurrentMeasureIndex(): number {
    const iterator = this.osmd.cursor.Iterator;
    return iterator?.CurrentMeasureIndex ?? 0;
  }

  setZoom(zoom: number): void {
    const clamped = Math.max(ScoreRenderer.MIN_ZOOM, Math.min(ScoreRenderer.MAX_ZOOM, zoom));
    this.osmd.Zoom = clamped;
    this.osmd.render();
    this.osmd.cursor.show();
  }

  getZoom(): number {
    return this.osmd.Zoom;
  }

  dispose(): void {
    // OSMD's clear() removes the rendered SVG and the autoResize window listener.
    this.osmd.clear();
  }
}
