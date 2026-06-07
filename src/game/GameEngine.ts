import { GameConfig, GameState, Note, Judgment, JudgmentDisplay, KanjiEntry } from '../types/game';
import { Chart } from '../charts/types';
import { AudioEngine } from '../audio/AudioEngine';

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
  PERFECT: '#FFD700', GREAT: '#4CC9F0', GOOD: '#FFFFFF', MISS: '#FF4D6D',
};

interface ScheduledNote {
  hitTime: number;
  laneIndex: number;
  displayText: string;
}

interface NoteTemplate {
  laneIndex: number;
  displayText: string;
}

const LEAD_IN_BEATS = 4;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private audio: AudioEngine | null;

  private notes: Note[] = [];
  private schedule: ScheduledNote[] = [];
  private scheduleIdx = 0;

  laneLabels: string[] = [];
  private laneColors: string[];
  private keyMap: Record<string, number>;

  state: GameState;
  private rafId = 0;
  private startTimestamp = 0; // performance.now() fallback
  private lastTimestamp = 0;
  currentTime = 0;

  private approachTime: number;
  private beatInterval: number;
  private leadInMs: number;
  private hitZoneRatio = 0.86;

  private judgmentDisplays: JudgmentDisplay[] = [];
  private lanePressed: boolean[] = [];
  private noteIdSeq = 0;

  // Mode 3
  private mode3Targets: KanjiEntry[] = [];
  private mode3CurrentTargetIdx = 0;
  private mode3RadicalsHitForCurrent: Set<string> = new Set();

  private getTime: () => number = () => 0;

  private onStateUpdate: (state: Readonly<GameState>) => void;
  private onGameOver: (state: Readonly<GameState>) => void;

  constructor(
    canvas: HTMLCanvasElement,
    config: GameConfig,
    onStateUpdate: (state: Readonly<GameState>) => void,
    onGameOver: (state: Readonly<GameState>) => void,
    audio: AudioEngine | null = null,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = config;
    this.onStateUpdate = onStateUpdate;
    this.onGameOver = onGameOver;
    this.audio = audio;

    this.approachTime = APPROACH_TIMES[config.approachRate] ?? 1100;
    this.beatInterval = 60000 / config.bpm;
    this.leadInMs = LEAD_IN_BEATS * this.beatInterval;
    this.laneColors = config.keyCount === 4 ? LANE_COLORS_4 : LANE_COLORS_7;
    this.keyMap = config.keyCount === 4 ? KEY_MAP_4 : KEY_MAP_7;
    this.lanePressed = new Array(config.keyCount).fill(false);

    this.state = {
      score: 0, combo: 0, maxCombo: 0, totalNotes: 0, hitNotes: 0,
      judgmentCounts: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
      isRunning: false, isComplete: false,
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

  private applyMode3Labels(idx: number) {
    const { keyCount } = this.config;
    const target = this.mode3Targets[idx];
    if (!target) return;
    const uniq = [...new Set(target.radicals)];
    this.laneLabels = Array.from({ length: keyCount }, (_, i) => uniq[i] ?? '—');
    this.state = {
      ...this.state,
      mode3Progress: { assembled: idx, total: this.mode3Targets.length, currentTarget: target.char },
    };
  }

  // ── Schedule building ─────────────────────────────────────────────────────

  private buildTemplates(): NoteTemplate[][] {
    const { mode, kanjiSet, keyCount } = this.config;
    const entries = kanjiSet.entries.slice(0, keyCount);
    const tpl: NoteTemplate[][] = Array.from({ length: keyCount }, () => []);

    if (mode === 'mode1') {
      entries.forEach((e, lane) => {
        tpl[lane].push(
          { laneIndex: lane, displayText: e.onyomi },
          { laneIndex: lane, displayText: e.kunyomi },
          { laneIndex: lane, displayText: e.meaning },
        );
      });
    } else if (mode === 'mode2') {
      entries.forEach((e, lane) => {
        tpl[lane].push({ laneIndex: lane, displayText: e.char });
      });
    }
    return tpl;
  }

  private generateSchedule() {
    if (this.config.chart) {
      this.generateChartSchedule(this.config.chart);
    } else if (this.config.mode === 'mode3') {
      this.generateMode3Schedule();
    } else {
      this.generateRandomSchedule();
    }
  }

  private generateChartSchedule(chart: Chart) {
    const templates = this.buildTemplates();
    const cycles = new Array(this.config.keyCount).fill(0);

    this.schedule = chart.notes
      .map(({ beat, lane }) => {
        const hitTime = this.leadInMs + (beat - 1) * this.beatInterval;
        const laneT = templates[lane] ?? [];
        const displayText = laneT.length > 0
          ? laneT[cycles[lane]++ % laneT.length].displayText
          : '?';
        return { hitTime, laneIndex: lane, displayText };
      })
      .sort((a, b) => a.hitTime - b.hitTime);
  }

  private generateRandomSchedule() {
    const { keyCount, totalNotes } = this.config;
    const templates = this.buildTemplates();
    const flat = templates.flat();
    const laneLastHit = new Array(keyCount).fill(-Infinity);
    const minGap = this.beatInterval * 1.5;
    const schedule: ScheduledNote[] = [];
    let time = this.leadInMs;
    let attempts = 0;
    let count = 0;

    while (count < totalNotes && attempts < totalNotes * 10) {
      attempts++;
      const avail = Array.from({ length: keyCount }, (_, i) => i)
        .filter(l => time - laneLastHit[l] >= minGap);

      if (avail.length === 0) { time += this.beatInterval * 0.5; continue; }

      const lane = avail[Math.floor(Math.random() * avail.length)];
      const lt = flat.filter(t => t.laneIndex === lane);
      if (lt.length === 0) continue;

      const tpl = lt[Math.floor(Math.random() * lt.length)];
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
    let time = this.leadInMs;

    this.mode3Targets.forEach(target => {
      const uniq = [...new Set(target.radicals)].slice(0, keyCount);
      uniq.forEach((radical, i) => {
        schedule.push({ hitTime: time, laneIndex: i, displayText: radical });
        time += this.beatInterval;
      });
      time += this.beatInterval * 2;
    });

    this.schedule = schedule;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.audio) {
      await this.audio.start(this.config.bpm, LEAD_IN_BEATS);
      this.getTime = () => this.audio!.currentMs;
    } else {
      this.startTimestamp = performance.now();
      this.getTime = () => performance.now() - this.startTimestamp;
    }
    this.state.isRunning = true;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.state.isRunning = false;
    this.audio?.stop();
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  handleKeyDown(key: string) {
    const lane = this.keyMap[key];
    if (lane === undefined) return;
    this.lanePressed[lane] = true;
    setTimeout(() => { this.lanePressed[lane] = false; }, 120);
    this.tryHit(lane);
  }

  private tryHit(lane: number) {
    const candidates = this.notes.filter(n => n.laneIndex === lane && !n.hit && !n.missed);
    if (candidates.length === 0) return;

    const best = candidates.reduce((a, b) =>
      Math.abs(this.currentTime - a.hitTime) <= Math.abs(this.currentTime - b.hitTime) ? a : b,
    );

    const offset = Math.abs(this.currentTime - best.hitTime);
    if (offset > TIMING_WINDOWS.GOOD + 40) return;

    const j = this.calcJudgment(offset);
    this.applyJudgment(best, j);

    if (this.config.mode === 'mode3') this.checkMode3(best.displayText);
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
    this.audio?.playHit(judgment);

    if (judgment !== 'MISS') {
      this.state.hitNotes++;
      this.state.combo++;
      if (this.state.combo > this.state.maxCombo) this.state.maxCombo = this.state.combo;
      const mult = COMBO_MULTIPLIERS.find(([t]) => this.state.combo >= t)?.[1] ?? 1;
      this.state.score += Math.round(SCORE_MAP[judgment] * mult);
    } else {
      this.state.combo = 0;
    }

    this.state.judgmentCounts[judgment]++;

    const hitY = this.canvas.height * this.hitZoneRatio;
    this.judgmentDisplays.push({ laneIndex: note.laneIndex, judgment, alpha: 1, y: hitY - 50 });
    this.onStateUpdate({ ...this.state });
  }

  private checkMode3(radical: string) {
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

  // ── Game loop ─────────────────────────────────────────────────────────────

  private loop = (timestamp: number) => {
    const dt = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.currentTime = this.getTime();

    this.spawnDue();
    this.updateNotes(dt);
    this.render();

    const allSpawned = this.scheduleIdx >= this.schedule.length;
    const allDone = this.notes.every(n => n.hit || n.missed);

    if (allSpawned && allDone && this.currentTime > this.leadInMs) {
      this.finish();
      return;
    }

    if (this.state.isRunning) this.rafId = requestAnimationFrame(this.loop);
  };

  private spawnDue() {
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
        y: 0, hit: false, missed: false,
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
        this.audio?.playHit('MISS');
        const hitY = this.canvas.height * this.hitZoneRatio;
        this.judgmentDisplays.push({ laneIndex: note.laneIndex, judgment: 'MISS', alpha: 1, y: hitY - 50 });
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

  private finish() {
    this.state.isRunning = false;
    this.state.isComplete = true;
    cancelAnimationFrame(this.rafId);
    this.audio?.stop();
    this.onGameOver({ ...this.state });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render() {
    const { canvas, ctx, config } = this;
    const W = canvas.width;
    const H = canvas.height;
    const lanes = config.keyCount;
    const hitY = H * this.hitZoneRatio;
    const laneW = W / lanes;
    const noteH = Math.max(56, Math.min(88, laneW * 0.58));

    ctx.clearRect(0, 0, W, H);
    this.drawBg(W, H, laneW, lanes, hitY);
    this.drawBeatFlash(W, H);
    this.drawNotes(laneW, hitY, noteH, H);
    this.drawReceptors(laneW, hitY, noteH, lanes);
    this.drawLabels(laneW, lanes, H, hitY, noteH);
    this.drawJudgments(laneW);
    if (config.mode === 'mode3') this.drawMode3Header(W);
  }

  private drawBg(W: number, H: number, laneW: number, lanes: number, hitY: number) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#050510');
    g.addColorStop(1, '#0d0d1f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < lanes; i++) {
      const x = i * laneW;
      const c = this.laneColors[i];
      ctx.fillStyle = c + '08';
      ctx.fillRect(x, 0, laneW, H);
      if (i > 0) {
        ctx.strokeStyle = c + '2a';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke();
  }

  private drawBeatFlash(W: number, H: number) {
    if (!this.audio) return;
    const beatMs = this.beatInterval;
    const phase = (this.currentTime % beatMs) / beatMs;
    const flash = Math.max(0, 1 - phase * 6); // quick decay after each beat
    if (flash <= 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.03})`;
    ctx.fillRect(0, 0, W, H);
  }

  private drawNotes(laneW: number, hitY: number, noteH: number, H: number) {
    const ctx = this.ctx;
    const pad = 6;

    for (const note of this.notes) {
      if (note.missed) continue;
      const noteY = note.y * hitY - noteH;
      if (noteY > H + noteH || noteY < -noteH * 2) continue;

      const x = note.laneIndex * laneW + pad;
      const w = laneW - pad * 2;
      const color = this.laneColors[note.laneIndex];

      ctx.save();
      if (note.hit) ctx.globalAlpha = Math.max(0, 1 - (note.y - 0.86) * 6);

      this.rr(ctx, x, noteY, w, noteH, 8);
      ctx.fillStyle = color + '30';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Subtle inner highlight
      this.rr(ctx, x + 2, noteY + 2, w - 4, 6, 4);
      ctx.fillStyle = color + '44';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lines = note.displayText.split('\n');
      const fontSize = note.displayText.length > 4 ? 17 : 26;
      ctx.font = `bold ${fontSize}px "Noto Sans JP", sans-serif`;

      if (lines.length === 1) {
        ctx.fillText(note.displayText, x + w / 2, noteY + noteH / 2);
      } else {
        ctx.font = 'bold 14px "Noto Sans JP", sans-serif';
        lines.forEach((line, idx) => ctx.fillText(line, x + w / 2, noteY + noteH / 2 + (idx - 0.5) * 18));
      }

      ctx.restore();
    }
  }

  private drawReceptors(laneW: number, hitY: number, noteH: number, lanes: number) {
    const ctx = this.ctx;
    const pad = 6;

    for (let i = 0; i < lanes; i++) {
      const x = i * laneW + pad;
      const w = laneW - pad * 2;
      const color = this.laneColors[i];
      const pressed = this.lanePressed[i];

      this.rr(ctx, x, hitY, w, noteH, 8);
      ctx.fillStyle = pressed ? color + '50' : color + '18';
      ctx.fill();
      ctx.strokeStyle = pressed ? color : color + '70';
      ctx.lineWidth = pressed ? 3 : 2;
      ctx.stroke();

      if (pressed) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        this.rr(ctx, x, hitY, w, noteH, 8);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawLabels(laneW: number, lanes: number, H: number, hitY: number, noteH: number) {
    const ctx = this.ctx;
    const keyLabels4 = ['D', 'F', 'J', 'K'];
    const keyLabels7 = ['S', 'D', 'F', '␣', 'J', 'K', 'L'];

    for (let i = 0; i < lanes; i++) {
      const label = this.laneLabels[i] ?? '';
      if (!label || label === '—') continue;

      const cx = i * laneW + laneW / 2;
      const y = hitY + noteH + 18;
      const color = this.laneColors[i];
      const lines = label.split('\n');

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (lines[0].length <= 3) {
        ctx.font = 'bold 30px "Noto Sans JP", sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(lines[0], cx, y);
        if (lines[1]) {
          ctx.font = '13px "Noto Sans JP", sans-serif';
          ctx.fillStyle = color + 'aa';
          ctx.fillText(lines[1], cx, y + 36);
        }
      } else {
        ctx.font = 'bold 16px "Noto Sans JP", sans-serif';
        ctx.fillStyle = color;
        lines.forEach((l, idx) => ctx.fillText(l, cx, y + idx * 20));
      }

      const kl = this.config.keyCount === 4 ? keyLabels4[i] : keyLabels7[i];
      ctx.font = '11px "Rajdhani", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText(kl ?? '', cx, H - 18);
    }
  }

  private drawJudgments(laneW: number) {
    const ctx = this.ctx;
    for (const jd of this.judgmentDisplays) {
      ctx.save();
      ctx.globalAlpha = jd.alpha;
      ctx.fillStyle = JUDGMENT_COLORS[jd.judgment];
      ctx.font = 'bold 20px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(jd.judgment, jd.laneIndex * laneW + laneW / 2, jd.y);
      ctx.restore();
    }
  }

  private drawMode3Header(W: number) {
    const ctx = this.ctx;
    const p = this.state.mode3Progress;
    if (!p) return;
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(0, 0, W, 112);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = '12px "Rajdhani", sans-serif';
    ctx.fillText('ASSEMBLE', W / 2, 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 68px "Noto Sans JP", sans-serif';
    ctx.fillText(p.currentTarget ?? '', W / 2, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '12px "Rajdhani", sans-serif';
    ctx.fillText(`${p.assembled} / ${p.total} assembled`, W / 2, 94);
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
