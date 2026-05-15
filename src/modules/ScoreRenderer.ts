import {
  OpenSheetMusicDisplay,
  type IOSMDOptions,
} from "opensheetmusicdisplay";
import type { DisplayMode } from "../types";

export class ScoreRenderer {
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
    for (let i = 0; i < measureIndex; i++) {
      this.osmd.cursor.next();
    }
  }

  getCurrentMeasureIndex(): number {
    const iterator = this.osmd.cursor.Iterator;
    return iterator?.CurrentMeasureIndex ?? 0;
  }
}
