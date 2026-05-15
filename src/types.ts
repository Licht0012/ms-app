export type PartInfo = {
  index: number;        // OSMD のパートインデックス
  name: string;         // MusicXML <part-name>
  shortName: string;    // <part-abbreviation> または name の先頭文字
};

export type PlayMode = "emphasize" | "solo" | "minusOne";
export type DisplayMode = "all" | "selectedOnly";

export type ScorePlayState = {
  selectedPartIndex: number;
  playMode: PlayMode;
  displayMode: DisplayMode;
  cursorMeasure: number;
  tempo: number;
};

export type ScoreRecord = {
  id: string;
  title: string;
  parts: PartInfo[];
  xmlContent: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
  lastState?: ScorePlayState;
};

export type ScoreMeta = Pick<ScoreRecord, "title" | "parts">;
