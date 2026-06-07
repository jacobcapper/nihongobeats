export type Difficulty = 'easy' | 'normal' | 'hard';

export interface ChartNote {
  beat: number; // 1-indexed; 1.5 = "and" of beat 1, 1.25 = first 16th of beat 1
  lane: number; // 0-based lane index
}

export interface Chart {
  id: string;
  name: string;
  difficulty: Difficulty;
  keyCount: 4 | 7;
  notes: ChartNote[];
}
