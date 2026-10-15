import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from './i18n/useLanguage';
import { Language, languageFlags, languageCodes } from './i18n/translations';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Difficulty = 'easy' | 'normal' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

interface Position {
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 180,
  normal: 120,
  hard: 70,
};

function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
}

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showSettings, setShowSettings] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const directionRef = useRef<Direction>(direction);
  const gameStateRef = useRef<GameState>(gameState);
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Position>(food);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameLoopRef = useRef<number | null>(null);

  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection('RIGHT');
    setScore(0);
    setGameState('playing');
  }, []);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  const moveSnake = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    const currentSnake = snakeRef.current;
    const currentFood = foodRef.current;
    const currentDir = directionRef.current;
    const head = currentSnake[0];

    let newHead: Position;
    switch (currentDir) {
      case 'UP': newHead = { x: head.x, y: head.y - 1 }; break;
      case 'DOWN': newHead = { x: head.x, y: head.y + 1 }; break;
      case 'LEFT': newHead = { x: head.x - 1, y: head.y }; break;
      case 'RIGHT': newHead = { x: head.x + 1, y: head.y }; break;
    }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      setGameState('gameover');
      return;
    }

    // Self collision
    if (currentSnake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
      setGameState('gameover');
      return;
    }

    const newSnake = [newHead, ...currentSnake];
    let newFood = currentFood;

    if (newHead.x === currentFood.x && newHead.y === currentFood.y) {
      newFood = getRandomPosition(newSnake);
      setFood(newFood);
      setScore(prev => {
        const newScore = prev + 10;
        setHighScore(hs => {
          const newHigh = Math.max(hs, newScore);
          localStorage.setItem('snake-high-score', String(newHigh));
          return newHigh;
        });
        return newScore;
      });
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = window.setInterval(moveSnake, SPEEDS[difficulty]);
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, difficulty, moveSnake]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'idle') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          resetGame();
          return;
        }
      }

      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
          togglePause();
        }
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      const currentDir = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (currentDir !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (currentDir !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (currentDir !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (currentDir !== 'LEFT') setDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame, togglePause]);

  // Touch swipe controls
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
      if (gameStateRef.current !== 'playing') return;

      const currentDir = directionRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && currentDir !== 'LEFT') setDirection('RIGHT');
        else if (dx < 0 && currentDir !== 'RIGHT') setDirection('LEFT');
      } else {
        if (dy > 0 && currentDir !== 'UP') setDirection('DOWN');
        else if (dy < 0 && currentDir !== 'DOWN') setDirection('UP');
      }

      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleDirectionButton = (dir: Direction) => {
    if (gameStateRef.current !== 'playing') return;
    const currentDir = directionRef.current;
    const opposites: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    if (dir !== opposites[currentDir]) {
      setDirection(dir);
    }
  };

  const getDifficultyLabel = (d: Difficulty) => {
    switch (d) {
      case 'easy': return t.easy;
      case 'normal': return t.normal;
      case 'hard': return t.hard;
    }
  };

  const cellSize = 100 / GRID_SIZE;

  const getLanguageName = (code: Language): string => {
    switch (code) {
      case 'es': return t.spanish;
      case 'en': return t.english;
      case 'ru': return t.russian;
      case 'zh': return t.chinese;
      case 'fr': return t.french;
      case 'de': return t.german;
      case 'ja': return t.japanese;
      case 'pt': return t.portuguese;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col items-center justify-center p-2 sm:p-4 select-none overflow-hidden">
      {/* Main Container */}
      <div className="w-full max-w-lg flex flex-col gap-3 sm:gap-4">
        
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl">🐍</span>
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          
          {/* Top-right buttons */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowLangMenu(!showLangMenu); setShowSettings(false); }}
                className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all duration-200 border border-white/10"
                aria-label={t.language}
              >
                <span className="text-base sm:text-lg">{languageFlags[language]}</span>
                <span className="hidden sm:inline text-xs">{getLanguageName(language)}</span>
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Language Dropdown */}
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowLangMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 bg-slate-800/95 backdrop-blur-md rounded-xl border border-white/15 shadow-2xl shadow-black/50 overflow-hidden min-w-[180px] animate-fade-in">
                    <div className="p-2 border-b border-white/10">
                      <p className="text-xs text-purple-300 font-medium px-2">{t.language}</p>
                    </div>
                    <div className="p-1 max-h-64 overflow-y-auto">
                      {languageCodes.map(code => (
                        <button
                          key={code}
                          onClick={() => { setLanguage(code); setShowLangMenu(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                            language === code
                              ? 'bg-green-500/20 text-green-300'
                              : 'text-white/80 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="text-lg">{languageFlags[code]}</span>
                          <span className="font-medium">{getLanguageName(code)}</span>
                          {language === code && (
                            <svg className="w-4 h-4 ml-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Settings Button */}
            <button
              onClick={() => { setShowSettings(!showSettings); setShowLangMenu(false); }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200 border border-white/10"
              aria-label={t.settings}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Score Board */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-3 border border-white/10">
            <p className="text-[10px] sm:text-xs text-purple-300 uppercase tracking-wide font-medium truncate">{t.score}</p>
            <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{score}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-3 border border-white/10">
            <p className="text-[10px] sm:text-xs text-yellow-300 uppercase tracking-wide font-medium truncate">{t.highScore}</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-200 tabular-nums">{highScore}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-3 border border-white/10">
            <p className="text-[10px] sm:text-xs text-emerald-300 uppercase tracking-wide font-medium truncate">{t.difficulty}</p>
            <p className="text-sm sm:text-lg font-bold text-emerald-200 truncate">{getDifficultyLabel(difficulty)}</p>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10 animate-fade-in">
            <p className="text-xs sm:text-sm text-purple-200 mb-2 font-medium">{t.selectDifficulty}</p>
            <div className="flex gap-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                    difficulty === d
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {getDifficultyLabel(d)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Game Board */}
        <div className="relative w-full aspect-square">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden shadow-2xl shadow-purple-500/10">
            {/* Grid background */}
            <div className="absolute inset-0 opacity-[0.07]">
              {Array.from({ length: GRID_SIZE }).map((_, row) =>
                Array.from({ length: GRID_SIZE }).map((_, col) => (
                  <div
                    key={`${row}-${col}`}
                    className="absolute border border-white/50"
                    style={{
                      left: `${col * cellSize}%`,
                      top: `${row * cellSize}%`,
                      width: `${cellSize}%`,
                      height: `${cellSize}%`,
                    }}
                  />
                ))
              )}
            </div>

            {/* Food */}
            <div
              className="absolute transition-all duration-200 flex items-center justify-center animate-pulse-soft"
              style={{
                left: `${food.x * cellSize}%`,
                top: `${food.y * cellSize}%`,
                width: `${cellSize}%`,
                height: `${cellSize}%`,
              }}
            >
              <div className="w-[75%] h-[75%] bg-gradient-to-br from-red-400 to-pink-500 rounded-full shadow-lg shadow-red-500/50" />
            </div>

            {/* Snake */}
            {snake.map((segment, index) => {
              const isHead = index === 0;
              const opacity = 1 - (index / snake.length) * 0.35;
              return (
                <div
                  key={index}
                  className={`absolute transition-all duration-75 ${isHead ? 'z-10' : ''}`}
                  style={{
                    left: `${segment.x * cellSize}%`,
                    top: `${segment.y * cellSize}%`,
                    width: `${cellSize}%`,
                    height: `${cellSize}%`,
                    opacity,
                  }}
                >
                  <div
                    className={`w-[88%] h-[88%] mx-auto mt-[6%] rounded-sm sm:rounded-md ${
                      isHead
                        ? 'bg-gradient-to-br from-green-300 to-emerald-500 shadow-lg shadow-green-500/40'
                        : 'bg-gradient-to-br from-green-400 to-emerald-600'
                    }`}
                  />
                </div>
              );
            })}

            {/* IDLE Overlay */}
            {gameState === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                <div className="text-5xl sm:text-6xl mb-3 sm:mb-4 animate-bounce">🐍</div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{t.title}</h2>
                <p className="text-purple-200 text-xs sm:text-sm mb-4 sm:mb-6 text-center px-4">
                  {t.useArrows}
                </p>
                <button
                  onClick={resetGame}
                  className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200 text-sm sm:text-base"
                >
                  {t.play}
                </button>
              </div>
            )}

            {/* PAUSED Overlay */}
            {gameState === 'paused' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">⏸️</div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{t.paused}</h2>
                <button
                  onClick={togglePause}
                  className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200 text-sm sm:text-base"
                >
                  {t.resume}
                </button>
              </div>
            )}

            {/* GAME OVER Overlay */}
            {gameState === 'gameover' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20">
                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">💀</div>
                <h2 className="text-xl sm:text-2xl font-bold text-red-300 mb-1">{t.gameOver}</h2>
                <p className="text-white text-sm sm:text-lg mb-1">
                  {t.score}: <span className="font-bold text-green-300">{score}</span>
                </p>
                {score >= highScore && score > 0 && (
                  <p className="text-yellow-300 text-xs sm:text-sm mb-2 sm:mb-3 animate-pulse">{t.newRecord}</p>
                )}
                <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-3">
                  <button
                    onClick={resetGame}
                    className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200 text-sm sm:text-base"
                  >
                    {t.restart}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col gap-2 sm:gap-3">
          {/* Action buttons */}
          <div className="flex gap-2 sm:gap-3">
            {gameState === 'playing' && (
              <button
                onClick={togglePause}
                className="flex-1 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs sm:text-sm font-medium rounded-xl border border-white/10 transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <span>⏸️</span> {t.pause}
              </button>
            )}
            {(gameState === 'playing' || gameState === 'paused') && (
              <button
                onClick={resetGame}
                className="flex-1 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs sm:text-sm font-medium rounded-xl border border-white/10 transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <span>🔄</span> {t.restart}
              </button>
            )}
          </div>

          {/* D-Pad for mobile */}
          <div className="flex justify-center sm:hidden">
            <div className="grid grid-cols-3 gap-1.5 w-40 sm:w-44">
              <div />
              <button
                onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('UP'); }}
                className="aspect-square bg-white/15 hover:bg-white/25 active:bg-green-500/40 rounded-xl border border-white/10 flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
                aria-label="Up"
              >
                ▲
              </button>
              <div />
              <button
                onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('LEFT'); }}
                className="aspect-square bg-white/15 hover:bg-white/25 active:bg-green-500/40 rounded-xl border border-white/10 flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
                aria-label="Left"
              >
                ◀
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('DOWN'); }}
                className="aspect-square bg-white/15 hover:bg-white/25 active:bg-green-500/40 rounded-xl border border-white/10 flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
                aria-label="Down"
              >
                ▼
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('RIGHT'); }}
                className="aspect-square bg-white/15 hover:bg-white/25 active:bg-green-500/40 rounded-xl border border-white/10 flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
                aria-label="Right"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Desktop keyboard hints */}
          <div className="hidden sm:flex justify-center flex-wrap gap-3 sm:gap-4 text-[10px] sm:text-xs text-purple-300/60">
            <span>{t.keyboardHint}</span>
            <span>{t.spaceHint}</span>
            <span>{t.enterHint}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
