export type GameMode = 'mode1' | 'mode2' | 'mode3';
export type KeyCount = 4 | 7;
export type Judgment = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
export type AppScreen = 'menu' | 'mode-select' | 'game' | 'results';

export interface KanjiEntry {
  char: string;
  onyomi: string;
  kunyomi: string;
  meaning: string;
  radicals: string[];
}

export interface KanjiSet {
  id: string;
  name: string;
  description: string;
  entries: KanjiEntry[];
}

export interface Mode3Target {
  kanji: KanjiEntry;
  radicalSequence: string[];
}

export interface NoteTemplate {
  laneIndex: number;
  displayText: string;
}

export interface Note {
  id: string;
  laneIndex: number;
  displayText: string;
  hitTime: number;
  y: number;
  hit: boolean;
  missed: boolean;
  judgment?: Judgment;
  judgmentAlpha?: number;
}

export interface JudgmentDisplay {
  laneIndex: number;
  judgment: Judgment;
  alpha: number;
  y: number;
}

export interface GameState {
  score: number;
  combo: number;
  maxCombo: number;
  totalNotes: number;
  hitNotes: number;
  judgmentCounts: Record<Judgment, number>;
  isRunning: boolean;
  isComplete: boolean;
  mode3Progress?: { assembled: number; total: number; currentTarget?: string };
}

export interface GameConfig {
  mode: GameMode;
  keyCount: KeyCount;
  approachRate: number;
  bpm: number;
  kanjiSet: KanjiSet;
  totalNotes: number;
}

export interface ResultsData {
  config: GameConfig;
  state: GameState;
}
