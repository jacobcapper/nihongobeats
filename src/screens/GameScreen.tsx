import { useEffect, useRef, useState, useCallback } from 'react';
import { GameConfig, GameState, ResultsData } from '../types/game';
import { GameEngine } from '../game/GameEngine';

interface Props {
  config: GameConfig;
  onGameOver: (data: ResultsData) => void;
  onMenu: () => void;
}

export default function GameScreen({ config, onGameOver, onMenu }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [paused, setPaused] = useState(false);

  const handleStateUpdate = useCallback((state: Readonly<GameState>) => {
    setGameState({ ...state });
  }, []);

  const handleGameOver = useCallback((state: Readonly<GameState>) => {
    setGameState({ ...state });
    onGameOver({ config, state: { ...state } });
  }, [config, onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(canvas, config, handleStateUpdate, handleGameOver);
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      window.removeEventListener('resize', resize);
      engineRef.current = null;
    };
  }, [config, handleStateUpdate, handleGameOver]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPaused(p => !p);
        return;
      }
      if (!paused && engineRef.current) {
        e.preventDefault();
        engineRef.current.handleKeyDown(e.key);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused]);

  const accuracy = gameState
    ? gameState.hitNotes > 0
      ? Math.round(
          ((gameState.judgmentCounts.PERFECT * 1.0 +
            gameState.judgmentCounts.GREAT * 0.667 +
            gameState.judgmentCounts.GOOD * 0.333) /
            Math.max(1, gameState.hitNotes + gameState.judgmentCounts.MISS)) *
            100,
        )
      : 0
    : 0;

  const keyHints = config.keyCount === 4
    ? 'D  F  J  K'
    : 'S  D  F  ␣  J  K  L';

  return (
    <div className="screen game-screen">
      <div className="game-hud">
        <div className="hud-left">
          <button className="btn btn-ghost btn-sm" onClick={onMenu}>✕</button>
          <span className="hud-mode">
            {config.mode === 'mode1' ? '日→' : config.mode === 'mode2' ? '→日' : '日+月'}
          </span>
        </div>
        <div className="hud-center">
          <span className="hud-score">{(gameState?.score ?? 0).toLocaleString()}</span>
        </div>
        <div className="hud-right">
          <span className="hud-combo">
            {(gameState?.combo ?? 0) > 0 && `×${gameState!.combo}`}
          </span>
          <span className="hud-acc">{accuracy}%</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="game-canvas" />

      <div className="game-key-hint">{keyHints}</div>

      {paused && (
        <div className="pause-overlay">
          <div className="pause-box">
            <h2>PAUSED</h2>
            <button className="btn btn-primary" onClick={() => setPaused(false)}>Resume</button>
            <button className="btn btn-ghost" onClick={onMenu}>Quit</button>
          </div>
        </div>
      )}
    </div>
  );
}
