import { useState } from 'react';
import { GameConfig, GameMode, KeyCount } from '../types/game';
import { KANJI_SETS } from '../data/kanjiSets';
import { CHARTS, chartsFor } from '../charts/chartData';
import { Chart } from '../charts/types';

interface Props {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
}

const MODE_INFO: Record<GameMode, { label: string; icon: string; desc: string }> = {
  mode1: { label: 'Kanji → Reading', icon: '日→にち', desc: 'Kanji fall in lanes. Press the lane with its reading or meaning.' },
  mode2: { label: 'Reading → Kanji', icon: 'sun→日', desc: 'Readings/meanings fall. Press the lane with the matching kanji.' },
  mode3: { label: 'Radical Assembly', icon: '日+月→明', desc: 'Press radical components in order to assemble target kanji.' },
};

const DIFF_COLOR: Record<string, string> = {
  easy: '#4CC9F0',
  normal: '#FFBE0B',
  hard: '#FF4D6D',
};

export default function ModeSelect({ onStart, onBack }: Props) {
  const [mode, setMode] = useState<GameMode>('mode1');
  const [keyCount, setKeyCount] = useState<KeyCount>(4);
  const [setId, setSetId] = useState(KANJI_SETS[0].id);
  const [approachRate, setApproachRate] = useState(5);
  const [bpm, setBpm] = useState(120);
  const [selectedChart, setSelectedChart] = useState<Chart | null>(CHARTS[0]);

  const availableSets = mode === 'mode3'
    ? KANJI_SETS.filter(s => s.id === 'compounds')
    : KANJI_SETS.filter(s => s.entries.length >= keyCount);

  const availableCharts = mode !== 'mode3' ? chartsFor(keyCount) : [];

  function handleModeChange(m: GameMode) {
    setMode(m);
    if (m === 'mode3') {
      setSetId('compounds');
      setSelectedChart(null);
    } else {
      const charts = chartsFor(keyCount);
      setSelectedChart(charts[0] ?? null);
    }
  }

  function handleKeyCountChange(k: KeyCount) {
    setKeyCount(k);
    const charts = chartsFor(k);
    setSelectedChart(charts[0] ?? null);
  }

  function handleStart() {
    const kanjiSet = KANJI_SETS.find(s => s.id === setId) ?? KANJI_SETS[0];
    const totalNotes = selectedChart
      ? selectedChart.notes.length
      : mode === 'mode3'
        ? kanjiSet.entries.reduce((sum, e) => sum + new Set(e.radicals).size, 0)
        : 60;

    onStart({ mode, keyCount, approachRate, bpm, kanjiSet, totalNotes, chart: selectedChart ?? undefined });
  }

  return (
    <div className="screen select-screen">
      <div className="select-content">
        <div className="select-header">
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h2>Select Mode</h2>
        </div>

        {/* Mode */}
        <section className="select-section">
          <h3>Game Mode</h3>
          <div className="mode-cards">
            {(Object.keys(MODE_INFO) as GameMode[]).map(m => (
              <button
                key={m}
                className={`mode-card ${mode === m ? 'active' : ''}`}
                onClick={() => handleModeChange(m)}
              >
                <div className="mode-card-icon">{MODE_INFO[m].icon}</div>
                <div className="mode-card-label">{MODE_INFO[m].label}</div>
                <div className="mode-card-desc">{MODE_INFO[m].desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Key layout */}
        {mode !== 'mode3' && (
          <section className="select-section">
            <h3>Key Layout</h3>
            <div className="key-toggle">
              {([4, 7] as KeyCount[]).map(k => (
                <button
                  key={k}
                  className={`toggle-btn ${keyCount === k ? 'active' : ''}`}
                  onClick={() => handleKeyCountChange(k)}
                >
                  {k} Key
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Chart */}
        {availableCharts.length > 0 && (
          <section className="select-section">
            <h3>Chart</h3>
            <div className="chart-list">
              <button
                className={`chart-btn ${selectedChart === null ? 'active' : ''}`}
                onClick={() => setSelectedChart(null)}
              >
                <span className="chart-name">Random</span>
                <span className="chart-detail" style={{ color: 'rgba(255,255,255,0.4)' }}>Procedural · 60 notes</span>
              </button>
              {availableCharts.map(c => (
                <button
                  key={c.id}
                  className={`chart-btn ${selectedChart?.id === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedChart(c)}
                >
                  <span className="chart-name">{c.name}</span>
                  <span
                    className="chart-diff"
                    style={{ color: DIFF_COLOR[c.difficulty] }}
                  >
                    {c.difficulty.toUpperCase()}
                  </span>
                  <span className="chart-detail">{c.notes.length} notes</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Kanji set */}
        <section className="select-section">
          <h3>Kanji Set</h3>
          <div className="set-list">
            {availableSets.map(s => (
              <button
                key={s.id}
                className={`set-btn ${setId === s.id ? 'active' : ''}`}
                onClick={() => setSetId(s.id)}
              >
                <span className="set-name">{s.name}</span>
                <span className="set-desc">{s.description}</span>
                <span className="set-preview">{s.entries.slice(0, 4).map(e => e.char).join(' ')}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Difficulty */}
        <section className="select-section">
          <h3>Settings</h3>
          <div className="difficulty-row">
            <label><span>Approach Rate</span><span className="value">{approachRate}</span></label>
            <input type="range" min={1} max={9} value={approachRate}
              onChange={e => setApproachRate(Number(e.target.value))} className="slider" />
            <div className="slider-labels"><span>Slow</span><span>Fast</span></div>
          </div>
          <div className="difficulty-row">
            <label><span>BPM</span><span className="value">{bpm}</span></label>
            <input type="range" min={60} max={220} step={10} value={bpm}
              onChange={e => setBpm(Number(e.target.value))} className="slider" />
            <div className="slider-labels"><span>60</span><span>220</span></div>
          </div>
        </section>

        <div className="select-footer">
          <button className="btn btn-primary btn-large" onClick={handleStart}>START</button>
        </div>
      </div>
    </div>
  );
}
