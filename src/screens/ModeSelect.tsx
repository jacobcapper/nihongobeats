import { useState } from 'react';
import { GameConfig, GameMode, KeyCount } from '../types/game';
import { KANJI_SETS } from '../data/kanjiSets';

interface Props {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
}

const MODE_INFO: Record<GameMode, { label: string; desc: string; icon: string }> = {
  mode1: {
    label: 'Kanji → Reading',
    icon: '日→にち',
    desc: 'Kanji fall in lanes. Each lane is a reading or meaning. Press the correct key.',
  },
  mode2: {
    label: 'Reading → Kanji',
    icon: 'sun→日',
    desc: 'Readings/meanings fall. Each lane holds a kanji. Match them correctly.',
  },
  mode3: {
    label: 'Radical Assembly',
    icon: '日+月→明',
    desc: 'Press radical components in sequence to assemble target kanji.',
  },
};

export default function ModeSelect({ onStart, onBack }: Props) {
  const [mode, setMode] = useState<GameMode>('mode1');
  const [keyCount, setKeyCount] = useState<KeyCount>(4);
  const [setId, setSetId] = useState(KANJI_SETS[0].id);
  const [approachRate, setApproachRate] = useState(5);
  const [bpm, setBpm] = useState(120);

  const availableSets = mode === 'mode3'
    ? KANJI_SETS.filter(s => s.id === 'compounds')
    : KANJI_SETS.filter(s => s.entries.length >= keyCount);

  function handleStart() {
    const kanjiSet = KANJI_SETS.find(s => s.id === setId) ?? KANJI_SETS[0];
    onStart({
      mode,
      keyCount,
      approachRate,
      bpm,
      kanjiSet,
      totalNotes: mode === 'mode3' ? kanjiSet.entries.length * 3 : 60,
    });
  }

  return (
    <div className="screen select-screen">
      <div className="select-content">
        <div className="select-header">
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h2>Select Mode</h2>
        </div>

        <section className="select-section">
          <h3>Game Mode</h3>
          <div className="mode-cards">
            {(Object.keys(MODE_INFO) as GameMode[]).map(m => (
              <button
                key={m}
                className={`mode-card ${mode === m ? 'active' : ''}`}
                onClick={() => {
                  setMode(m);
                  if (m === 'mode3') setSetId('compounds');
                }}
              >
                <div className="mode-card-icon">{MODE_INFO[m].icon}</div>
                <div className="mode-card-label">{MODE_INFO[m].label}</div>
                <div className="mode-card-desc">{MODE_INFO[m].desc}</div>
              </button>
            ))}
          </div>
        </section>

        {mode !== 'mode3' && (
          <section className="select-section">
            <h3>Key Layout</h3>
            <div className="key-toggle">
              {([4, 7] as KeyCount[]).map(k => (
                <button
                  key={k}
                  className={`toggle-btn ${keyCount === k ? 'active' : ''}`}
                  onClick={() => setKeyCount(k)}
                >
                  {k} Key
                </button>
              ))}
            </div>
          </section>
        )}

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
                <span className="set-preview">
                  {s.entries.slice(0, 4).map(e => e.char).join(' ')}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="select-section">
          <h3>Difficulty</h3>
          <div className="difficulty-row">
            <label>
              <span>Approach Rate</span>
              <span className="value">{approachRate}</span>
            </label>
            <input
              type="range"
              min={1}
              max={9}
              value={approachRate}
              onChange={e => setApproachRate(Number(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </div>

          <div className="difficulty-row">
            <label>
              <span>BPM</span>
              <span className="value">{bpm}</span>
            </label>
            <input
              type="range"
              min={60}
              max={200}
              step={10}
              value={bpm}
              onChange={e => setBpm(Number(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>60</span>
              <span>200</span>
            </div>
          </div>
        </section>

        <div className="select-footer">
          <button className="btn btn-primary btn-large" onClick={handleStart}>
            START
          </button>
        </div>
      </div>
    </div>
  );
}
