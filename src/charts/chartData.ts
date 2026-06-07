import { Chart, ChartNote } from './types';

// ── Generators ────────────────────────────────────────────────────────────

function rep(pattern: { beat: number; lane: number }[], numBars: number, bpb = 4): ChartNote[] {
  const out: ChartNote[] = [];
  for (let b = 0; b < numBars; b++) {
    for (const n of pattern) {
      out.push({ beat: n.beat + b * bpb, lane: n.lane });
    }
  }
  return out;
}

// ── 4-Key charts ──────────────────────────────────────────────────────────

function easy4K(numBars = 16): ChartNote[] {
  return Array.from({ length: numBars * 4 }, (_, i) => ({
    beat: i + 1,
    lane: [0, 1, 2, 3][i % 4],
  }));
}

function normal4K(numBars = 12): ChartNote[] {
  return rep([
    { beat: 1, lane: 0 }, { beat: 1.5, lane: 2 },
    { beat: 2, lane: 1 }, { beat: 2.5, lane: 3 },
    { beat: 3, lane: 2 }, { beat: 3.5, lane: 0 },
    { beat: 4, lane: 3 }, { beat: 4.5, lane: 1 },
  ], numBars);
}

function hard4K(numBars = 10): ChartNote[] {
  // 2-bar super-pattern
  const sp = [
    // bar A: stream then burst
    { beat: 1, lane: 0 }, { beat: 1.5, lane: 2 }, { beat: 2, lane: 1 }, { beat: 2.5, lane: 3 },
    { beat: 3, lane: 0 }, { beat: 3.25, lane: 1 }, { beat: 3.5, lane: 2 }, { beat: 3.75, lane: 3 },
    { beat: 4, lane: 1 }, { beat: 4.5, lane: 0 },
    // bar B: different flow
    { beat: 5, lane: 3 }, { beat: 5.5, lane: 1 }, { beat: 6, lane: 2 }, { beat: 6.25, lane: 0 },
    { beat: 6.5, lane: 3 }, { beat: 6.75, lane: 2 },
    { beat: 7, lane: 0 }, { beat: 7.5, lane: 1 }, { beat: 8, lane: 2 }, { beat: 8.5, lane: 3 },
  ];
  const out: ChartNote[] = [];
  const pairs = Math.floor(numBars / 2);
  for (let p = 0; p < pairs; p++) {
    for (const n of sp) out.push({ beat: n.beat + p * 8, lane: n.lane });
  }
  return out;
}

// ── 7-Key charts ──────────────────────────────────────────────────────────

function easy7K(numBars = 16): ChartNote[] {
  return Array.from({ length: numBars * 4 }, (_, i) => ({
    beat: i + 1,
    lane: [0, 1, 2, 3, 4, 5, 6][i % 7],
  }));
}

function normal7K(numBars = 10): ChartNote[] {
  return rep([
    { beat: 1, lane: 0 }, { beat: 1.5, lane: 4 },
    { beat: 2, lane: 1 }, { beat: 2.5, lane: 5 },
    { beat: 3, lane: 2 }, { beat: 3.5, lane: 6 },
    { beat: 4, lane: 3 }, { beat: 4.5, lane: 2 },
  ], numBars);
}

function hard7K(numBars = 8): ChartNote[] {
  const sp = [
    { beat: 1, lane: 0 }, { beat: 1.5, lane: 3 }, { beat: 2, lane: 6 }, { beat: 2.5, lane: 2 },
    { beat: 3, lane: 4 }, { beat: 3.25, lane: 1 }, { beat: 3.5, lane: 5 }, { beat: 3.75, lane: 3 },
    { beat: 4, lane: 0 }, { beat: 4.5, lane: 6 },
    { beat: 5, lane: 2 }, { beat: 5.5, lane: 4 }, { beat: 6, lane: 1 }, { beat: 6.25, lane: 5 },
    { beat: 6.5, lane: 0 }, { beat: 6.75, lane: 3 },
    { beat: 7, lane: 6 }, { beat: 7.5, lane: 2 }, { beat: 8, lane: 4 }, { beat: 8.5, lane: 1 },
  ];
  const out: ChartNote[] = [];
  const pairs = Math.floor(numBars / 2);
  for (let p = 0; p < pairs; p++) {
    for (const n of sp) out.push({ beat: n.beat + p * 8, lane: n.lane });
  }
  return out;
}

// ── Exported charts ───────────────────────────────────────────────────────

export const CHARTS: Chart[] = [
  // 4-key
  { id: '4k-easy',   name: 'Easy',   difficulty: 'easy',   keyCount: 4, notes: easy4K(16) },
  { id: '4k-normal', name: 'Normal', difficulty: 'normal', keyCount: 4, notes: normal4K(12) },
  { id: '4k-hard',   name: 'Hard',   difficulty: 'hard',   keyCount: 4, notes: hard4K(10) },
  // 7-key
  { id: '7k-easy',   name: 'Easy',   difficulty: 'easy',   keyCount: 7, notes: easy7K(14) },
  { id: '7k-normal', name: 'Normal', difficulty: 'normal', keyCount: 7, notes: normal7K(10) },
  { id: '7k-hard',   name: 'Hard',   difficulty: 'hard',   keyCount: 7, notes: hard7K(8) },
];

export function chartsFor(keyCount: 4 | 7): Chart[] {
  return CHARTS.filter(c => c.keyCount === keyCount);
}
