import { GameConfig, GameState, Note, Judgment, JudgmentDisplay, KanjiEntry } from '../types/game';

const APPROACH_TIMES: Record<number, number> = {
  1: 2400, 2: 2000, 3: 1700, 4: 1400, 5: 1100, 6: 900, 7: 700, 8: 550, 9: 400,
};

const TIMING_WINDOWS = { PERFECT: 45, GREAT: 90, GOOD: 135 };

const SCORE_MAP: Record<Judgment, number> = {
  PERFECT: 300, GREAT: 200, GOOD: 100, MISS: 0,
};

const COMBO_MULTIPLIERS: [number, number][] = [
  [500, 2.0], [200, 1.5], [100, 1.25], [50, 1.1], [0, 1.0],
];

const LANE_COLORS_4 = ['#FF4D6D', '#4CC9F0', '#4CC9F0', '#FF4D6D'];
const LANE_COLORS_7 = ['#FF4D6D', '#FFBE0B', '#4CC9F0', '#FFFFFF', '#4CC9F0', '#FFBE0B', '#FF4D6D'];

const KEY_MAP_4: Record<string, number> = {
  d: 0, D: 0, f: 1, F: 1, j: 2, J: 2, k: 3, K: 3,
};
const KEY_MAP_7: Record<string, number> = {
  s: 0, S: 0, d: 1, D: 1, f: 2, F: 2, ' ': 3, j: 4, J: 4, k: 5, K: 5, l: 6, L: 6,
};

const JUDGMENT_COLORS: Record<Judgment, string> = {
  PERFECT: '#FFD700',
  GREAT: '#4CC9F0',
  GOOD: '#FFFFFF',
  MISS: '#FF4D6D',
};

interface ScheduledNote {
  hitTime: number;
  laneIndex: number;
  displayText: string;
  mode3TargetIdx?: number;
}

interface NoteTemplate {
  laneIndex: number;
  displayText: string;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;

  private notes: Note[] = [];
  private schedule: ScheduledNote[] = [];
  private scheduleIdx = 0;

  laneLabels: string[] = [];
  private laneColors: string[];
  private keyMap: Record<string, number>;

  state: GameState;
  private rafId = 0;
  private startTime = 0;
  private lastTimestamp = 0;
  currentTime = 0;

  private approachTime: number;
  private beatInterval: number;
  private hitZoneRatio = 0.86;

  private judgmentDisplays: JudgmentDisplay[] = [];
  private lanePressed: boolean[] = [];
  private noteIdSeq = 0;

  private mode3Targets: KanjiEntry[] = [];
  private mode3CurrentTargetIdx = 0;
  private mode3RadicalsHitForCurrent: Set<string> = new Set();

  private onStateUpdate: (state: Readonly<GameState>) => void;
  private onGameOver: (state: Readonly<GameState>) => void;

  constructor(
    canvas: HTMLCanvasElement,
    config: GameConfig,
    onStateUpdate: (state: Readonly<GameState>) => void,
    onGameOver: (state: Readonly<GameState>) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = config;
    this.onStateUpdate = onStateUpdate;
    this.onGameOver = onGameOver;

    this.approachTime = APPROACH_TIMES[config.approachRate] ?? 1100;
    this.beatInterval = (60 / config.bpm) * 1000;
    this.laneColors = config.keyCount === 4 ? LANE_COLORS_4 : LANE_COLORS_7;
    this.keyMap = config.keyCount === 4 ? KEY_MAP_4 : KEY_MAP_7;
    this.lanePressed = new Array(config.keyCount).fill(false);

    this.state = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      totalNotes: 0,
      hitNotes: 0,
      judgmentCounts: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
      isRunning: false,
      isComplete: false,
    };

    this.setupMode();
    this.generateSchedule();
    this.state.totalNotes = this.schedule.length;
  }

  private setupMode() {
    const { mode, kanjiSet, keyCount } = this.config;
    const entries = kanjiSet.entries.slice(0, keyCount);

    if (mode === 'mode1') {
      this.laneLabels = entries.map(e => e.char);
    } else if (mode === 'mode2') {
      this.laneLabels = entries.map(e => `${e.meaning}\n${e.onyomi}`);
    } else {
      this.mode3Targets = kanjiSet.entries;
      this.applyMode3Labels(0);
    }
  }

  private applyMode3Labels(targetIdx: number) {
    const { keyCount } = this.config;
    const target = this.mode3Targets[targetIdx];
    if (!target) return;

    const uniqueRadicals = [...new Set(target.radicals)];
    this.laneLabels = Array.from({ length: keyCount }, (_, i) => uniqueRadicals[i] ?? '—');

    this.state = {
      ...this.state,
      mode3Progress: {
        assembled: targetIdx,
        total: this.mode3Targets.length,
        currentTarget: target.char,
      },
    };
  }

  private generateSchedule() {
    const { mode } = this.config;
    if (mode === 'mode3') {
      this.generateMode3Schedule();
    } else {
      this.generateStandardSchedule();
    }
  }

  private generateStandardSchedule() {
    const { mode, keyCount, totalNotes, kanjiSet } = this.config;
    const entries = kanjiSet.entries.slice(0, keyCount);
    const templates: NoteTemplate[] = [];

    if (mode === 'mode1') {
      entries.forEach((entry, laneIndex) => {
        templates.push({ laneIndex, displayText: entry.onyomi });
        templates.push({ laneIndex, displayText: entry.kunyomi });
        templates.push({ laneIndex, displayText: entry.meaning });
      });
    } else {
      entries.forEach((entry, laneIndex) => {
        templates.push({ laneIndex, displayText: entry.char });
      });
    }

    const schedule: ScheduledNote[] = [];
    const laneLastHit: number[] = new Array(keyCount).fill(-Infinity);
    const minGap = this.beatInterval * 1.5;
    let time = 2000;
    let attempts = 0;
    let count = 0;

    while (count < totalNotes && attempts < totalNotes * 10) {
      attempts++;
      const available = Array.from({ length: keyCount }, (_, i) => i)
        .filter(lane => time - laneLastHit[lane] >= minGap);

      if (available.length === 0) {
        time += this.beatInterval * 0.5;
        continue;
      }

      const lane = available[Math.floor(Math.random() * available.length)];
      const laneTemplates = templates.filter(t => t.laneIndex === lane);
      if (laneTemplates.length === 0) continue;

      const tpl = laneTemplates[Math.floor(Math.random() * laneTemplates.length)];
      schedule.push({ hitTime: time, laneIndex: lane, displayText: tpl.displayText });
      laneLastHit[lane] = time;
      time += this.beatInterval;
      count++;
    }

    this.schedule = schedule;
  }

  private generateMode3Schedule() {
    const { keyCount } = this.config;
    const schedule: ScheduledNote[] = [];
    let time = 2000;

    this.mode3Targets.forEach((target, targetIdx) => {
      const uniqueRadicals = [...new Set(target.radicals)].slice(0, keyCount);
      uniqueRadicals.forEach((radical, i) => {
        schedule.push({
          hitTime: time,
          laneIndex: i,
          displayText: radical,
          mode3TargetIdx: targetIdx,
        });
        time += this.beatInterval;
      });
      time += this.beatInterval * 2;
    });

    this.schedule = schedule;
  }

  start() {
    this.state.isRunning = true;
    this.startTime = performance.now();
    this.lastTimestamp = this.startTime;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.state.isRunning = false;
  }

  handleKeyDown(key: string) {
    const laneIndex = this.keyMap[key];
    if (laneIndex === undefined) return;

    this.lanePressed[laneIndex] = true;
    setTimeout(() => { this.lanePressed[laneIndex] = false; }, 120);

    this.tryHitNote(laneIndex);
  }

  private tryHitNote(laneIndex: number) {
    const inLane = this.notes.filter(
      n => n.laneIndex === laneIndex && !n.hit && !n.missed,
    );
    if (inLane.length === 0) return;

    const closest = inLane.reduce((best, n) => {
      const bd = Math.abs(this.currentTime - best.hitTime);
      const nd = Math.abs(this.currentTime - n.hitTime);
      return nd < bd ? n : best;
    });

    const offset = Math.abs(this.currentTime - closest.hitTime);
    if (offset > TIMING_WINDOWS.GOOD + 40) return;

    const judgment = this.calcJudgment(offset);
    this.applyJudgment(closest, judgment);

    if (this.config.mode === 'mode3') {
      this.checkMode3Assembly(closest.displayText);
    }
  }

  private calcJudgment(offset: number): Judgment {
    if (offset <= TIMING_WINDOWS.PERFECT) return 'PERFECT';
    if (offset <= TIMING_WINDOWS.GREAT) return 'GREAT';
    if (offset <= TIMING_WINDOWS.GOOD) return 'GOOD';
    return 'MISS';
  }

  private applyJudgment(note: Note, judgment: Judgment) {
    note.hit = true;
    note.judgment = judgment;

    if (judgment === 'MISS') {
      this.state.combo = 0;
    } else {
      this.state.hitNotes++;
      this.state.combo++;
      if (this.state.combo > this.state.maxCombo) {
        this.state.maxCombo = this.state.combo;
      }

      const multiplier = COMBO_MULTIPLIERS.find(([threshold]) => this.state.combo >= threshold)?.[1] ?? 1;
      this.state.score += Math.round(SCORE_MAP[judgment] * multiplier);
    }

    this.state.judgmentCounts[judgment]++;

    const hitZoneY = this.canvas.height * this.hitZoneRatio;
    this.judgmentDisplays.push({
      laneIndex: note.laneIndex,
      judgment,
      alpha: 1,
      y: hitZoneY - 50,
    });

    this.onStateUpdate({ ...this.state });
  }

  private checkMode3Assembly(radical: string) {
    const target = this.mode3Targets[this.mode3CurrentTargetIdx];
    if (!target) return;

    this.mode3RadicalsHitForCurrent.add(radical);
    const needed = new Set(target.radicals);

    if ([...needed].every(r => this.mode3RadicalsHitForCurrent.has(r))) {
      this.mode3RadicalsHitForCurrent.clear();
      this.mode3CurrentTargetIdx++;

      if (this.mode3CurrentTargetIdx < this.mode3Targets.length) {
        this.applyMode3Labels(this.mode3CurrentTargetIdx);
        this.onStateUpdate({ ...this.state });
      }
    }
  }

  private loop = (timestamp: number) => {
    const dt = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.currentTime = timestamp - this.startTime;

    this.spawnDueNotes();
    this.updateNotes(dt);
    this.render();

    const allScheduled = this.scheduleIdx >= this.schedule.length;
    const allResolved = this.notes.every(n => n.hit || n.missed);

    if (allScheduled && allResolved && this.currentTime > 2000) {
      this.finishGame();
      return;
    }

    if (this.state.isRunning) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private spawnDueNotes() {
    while (
      this.scheduleIdx < this.schedule.length &&
      this.currentTime >= this.schedule[this.scheduleIdx].hitTime - this.approachTime
    ) {
      const s = this.schedule[this.scheduleIdx++];
      this.notes.push({
        id: String(this.noteIdSeq++),
        laneIndex: s.laneIndex,
        displayText: s.displayText,
        hitTime: s.hitTime,
        y: 0,
        hit: false,
        missed: false,
      });
    }
  }

  private updateNotes(dt: number) {
    const missWindow = TIMING_WINDOWS.GOOD + 80;

    for (const note of this.notes) {
      if (note.hit || note.missed) continue;

      const elapsed = this.currentTime - (note.hitTime - this.approachTime);
      note.y = elapsed / this.approachTime;

      if (this.currentTime > note.hitTime + missWindow) {
        note.missed = true;
        this.state.combo = 0;
        this.state.judgmentCounts.MISS++;
        this.state.totalNotes = Math.max(this.state.totalNotes, this.state.hitNotes + this.state.judgmentCounts.MISS);

        const hitZoneY = this.canvas.height * this.hitZoneRatio;
        this.judgmentDisplays.push({ laneIndex: note.laneIndex, judgment: 'MISS', alpha: 1, y: hitZoneY - 50 });
        this.onStateUpdate({ ...this.state });
      }
    }

    this.notes = this.notes.filter(n => n.y < 1.3 || n.hit);

    for (const jd of this.judgmentDisplays) {
      jd.alpha -= dt * 0.002;
      jd.y -= dt * 0.05;
    }
    this.judgmentDisplays = this.judgmentDisplays.filter(jd => jd.alpha > 0);
  }

  private finishGame() {
    this.state.isRunning = false;
    this.state.isComplete = true;
    cancelAnimationFrame(this.rafId);
    this.onGameOver({ ...this.state });
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  private render() {
    const { canvas, ctx, config } = this;
    const W = canvas.width;
    const H = canvas.height;
    const lanes = config.keyCount;
    const hitY = H * this.hitZoneRatio;
    const laneW = W / lanes;
    const noteH = Math.max(60, Math.min(90, laneW * 0.6));

    ctx.clearRect(0, 0, W, H);

    this.drawBackground(W, H, laneW, lanes, hitY);
    this.drawNotes(laneW, hitY, noteH, H);
    this.drawReceptors(laneW, hitY, noteH, lanes);
    this.drawLaneLabels(laneW, lanes, H, hitY, noteH);
    this.drawJudgments(laneW);

    if (config.mode === 'mode3') {
      this.drawMode3Header(W);
    }
  }

  private drawBackground(W: number, H: number, laneW: number, lanes: number, hitY: number) {
    const ctx = this.ctx;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#050510');
    grad.addColorStop(1, '#0d0d1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < lanes; i++) {
      const x = i * laneW;
      const color = this.laneColors[i];
      ctx.fillStyle = color + '08';
      ctx.fillRect(x, 0, laneW, H);

      if (i > 0) {
        ctx.strokeStyle = color + '33';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(W, hitY);
    ctx.stroke();
  }

  private drawNotes(laneW: number, hitY: number, noteH: number, H: number) {
    const ctx = this.ctx;
    const padding = 6;

    for (const note of this.notes) {
      if (note.missed) continue;

      const noteY = note.y * hitY - noteH;
      if (noteY > H + noteH || noteY < -noteH * 2) continue;

      const x = note.laneIndex * laneW + padding;
      const w = laneW - padding * 2;
      const color = this.laneColors[note.laneIndex];

      ctx.save();
      ctx.globalAlpha = note.hit ? Math.max(0, 1 - (note.y - this.hitZoneRatio / this.hitZoneRatio) * 5) : 1;

      this.roundRect(ctx, x, noteY, w, noteH, 8);
      ctx.fillStyle = color + '33';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      const fontSize = note.displayText.length > 4 ? 18 : 26;
      ctx.font = `bold ${fontSize}px "Noto Sans JP", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lines = note.displayText.split('\n');
      if (lines.length === 1) {
        ctx.fillText(note.displayText, x + w / 2, noteY + noteH / 2);
      } else {
        ctx.font = `bold 15px "Noto Sans JP", sans-serif`;
        lines.forEach((line, idx) => {
          ctx.fillText(line, x + w / 2, noteY + noteH / 2 + (idx - 0.5) * 18);
        });
      }

      ctx.restore();
    }
  }

  private drawReceptors(laneW: number, hitY: number, noteH: number, lanes: number) {
    const ctx = this.ctx;
    const padding = 6;

    for (let i = 0; i < lanes; i++) {
      const x = i * laneW + padding;
      const w = laneW - padding * 2;
      const color = this.laneColors[i];
      const pressed = this.lanePressed[i];

      this.roundRect(ctx, x, hitY, w, noteH, 8);
      ctx.fillStyle = pressed ? color + '55' : color + '22';
      ctx.fill();
      ctx.strokeStyle = pressed ? color : color + '88';
      ctx.lineWidth = pressed ? 3 : 2;
      ctx.stroke();

      if (pressed) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        this.roundRect(ctx, x, hitY, w, noteH, 8);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  private drawLaneLabels(laneW: number, lanes: number, H: number, hitY: number, noteH: number) {
    const ctx = this.ctx;

    for (let i = 0; i < lanes; i++) {
      const label = this.laneLabels[i] ?? '';
      if (!label || label === '—') continue;

      const x = i * laneW + laneW / 2;
      const y = hitY + noteH + 20;
      const color = this.laneColors[i];

      const lines = label.split('\n');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (lines[0].length <= 3) {
        ctx.font = `bold 32px "Noto Sans JP", sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(lines[0], x, y);
        if (lines[1]) {
          ctx.font = `14px "Noto Sans JP", sans-serif`;
          ctx.fillStyle = color + 'aa';
          ctx.fillText(lines[1], x, y + 38);
        }
      } else {
        ctx.font = `bold 18px "Noto Sans JP", sans-serif`;
        ctx.fillStyle = color;
        lines.forEach((line, idx) => ctx.fillText(line, x, y + idx * 22));
      }

      const keyLabels4 = ['D', 'F', 'J', 'K'];
      const keyLabels7 = ['S', 'D', 'F', '␣', 'J', 'K', 'L'];
      const keyLabel = this.config.keyCount === 4 ? keyLabels4[i] : keyLabels7[i];
      ctx.font = `12px "Rajdhani", sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(keyLabel ?? '', x, H - 20);
    }
  }

  private drawJudgments(laneW: number) {
    const ctx = this.ctx;

    for (const jd of this.judgmentDisplays) {
      ctx.save();
      ctx.globalAlpha = jd.alpha;
      ctx.fillStyle = JUDGMENT_COLORS[jd.judgment];
      ctx.font = `bold 22px "Rajdhani", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = jd.laneIndex * laneW + laneW / 2;
      ctx.fillText(jd.judgment, x, jd.y);
      ctx.restore();
    }
  }

  private drawMode3Header(W: number) {
    const ctx = this.ctx;
    const progress = this.state.mode3Progress;
    if (!progress) return;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, 110);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px "Rajdhani", sans-serif';
    ctx.fillText('ASSEMBLE', W / 2, 12);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 72px "Noto Sans JP", sans-serif`;
    ctx.fillText(progress.currentTarget ?? '', W / 2, 20);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px "Rajdhani", sans-serif';
    ctx.fillText(`${progress.assembled} / ${progress.total} assembled`, W / 2, 96);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
