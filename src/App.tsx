import { useState } from 'react';
import { AppScreen, GameConfig, ResultsData } from './types/game';
import MainMenu from './screens/MainMenu';
import ModeSelect from './screens/ModeSelect';
import GameScreen from './screens/GameScreen';
import ResultsScreen from './screens/ResultsScreen';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);

  function handlePlay() {
    setScreen('mode-select');
  }

  function handleConfigReady(config: GameConfig) {
    setGameConfig(config);
    setScreen('game');
  }

  function handleGameOver(data: ResultsData) {
    setResults(data);
    setScreen('results');
  }

  function handleReplay() {
    setScreen('game');
  }

  function handleMenu() {
    setGameConfig(null);
    setResults(null);
    setScreen('menu');
  }

  return (
    <div className="app">
      {screen === 'menu' && <MainMenu onPlay={handlePlay} />}
      {screen === 'mode-select' && (
        <ModeSelect onStart={handleConfigReady} onBack={handleMenu} />
      )}
      {screen === 'game' && gameConfig && (
        <GameScreen config={gameConfig} onGameOver={handleGameOver} onMenu={handleMenu} />
      )}
      {screen === 'results' && results && (
        <ResultsScreen results={results} onReplay={handleReplay} onMenu={handleMenu} />
      )}
    </div>
  );
}
