import { ResultsData, Judgment } from '../types/game';

interface Props {
  results: ResultsData;
  onReplay: () => void;
  onMenu: () => void;
}

const JUDGMENT_COLORS: Record<Judgment, string> = {
  PERFECT: '#FFD700',
  GREAT: '#4CC9F0',
  GOOD: '#FFFFFF',
  MISS: '#FF4D6D',
};

const GRADE_THRESHOLDS: [number, string][] = [
  [98, 'SS'],
  [95, 'S'],
  [90, 'A'],
  [80, 'B'],
  [70, 'C'],
  [0, 'D'],
];

function calcAccuracy(results: ResultsData): number {
  const { judgmentCounts, hitNotes } = results.state;
  const denom = Math.max(1, hitNotes + judgmentCounts.MISS);
  return (
    ((judgmentCounts.PERFECT * 1.0 +
      judgmentCounts.GREAT * 0.667 +
      judgmentCounts.GOOD * 0.333) /
      denom) *
    100
  );
}

function getGrade(acc: number): string {
  return GRADE_THRESHOLDS.find(([threshold]) => acc >= threshold)?.[1] ?? 'D';
}

export default function ResultsScreen({ results, onReplay, onMenu }: Props) {
  const { state, config } = results;
  const accuracy = calcAccuracy(results);
  const grade = getGrade(accuracy);
  const accDisplay = accuracy.toFixed(2);

  const modeLabel =
    config.mode === 'mode1' ? 'Kanji → Reading' :
    config.mode === 'mode2' ? 'Reading → Kanji' :
    'Radical Assembly';

  return (
    <div className="screen results-screen">
      <div className="results-content">
        <div className="results-header">
          <h2>{config.kanjiSet.name}</h2>
          <p className="results-mode">{modeLabel} · {config.keyCount}K · AR{config.approachRate}</p>
        </div>

        <div className="results-grade-row">
          <div className={`results-grade grade-${grade}`}>{grade}</div>
          <div className="results-score">
            <div className="results-score-value">{state.score.toLocaleString()}</div>
            <div className="results-score-label">Score</div>
          </div>
        </div>

        <div className="results-stats">
          <div className="stat-row">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{accDisplay}%</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Max Combo</span>
            <span className="stat-value">×{state.maxCombo}</span>
          </div>
        </div>

        <div className="results-judgments">
          {(['PERFECT', 'GREAT', 'GOOD', 'MISS'] as Judgment[]).map(j => (
            <div key={j} className="judgment-row">
              <span className="judgment-label" style={{ color: JUDGMENT_COLORS[j] }}>{j}</span>
              <span className="judgment-bar-wrap">
                <span
                  className="judgment-bar"
                  style={{
                    width: `${(state.judgmentCounts[j] / Math.max(1, state.totalNotes)) * 100}%`,
                    background: JUDGMENT_COLORS[j],
                  }}
                />
              </span>
              <span className="judgment-count">{state.judgmentCounts[j]}</span>
            </div>
          ))}
        </div>

        {config.mode === 'mode3' && state.mode3Progress && (
          <div className="results-mode3">
            <span>Assembled: {state.mode3Progress.assembled} / {state.mode3Progress.total} kanji</span>
          </div>
        )}

        <div className="results-actions">
          <button className="btn btn-primary btn-large" onClick={onReplay}>RETRY</button>
          <button className="btn btn-ghost btn-large" onClick={onMenu}>MENU</button>
        </div>
      </div>
    </div>
  );
}
