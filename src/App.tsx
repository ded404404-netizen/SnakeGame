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

function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(15);
  }
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
  const [activeButton, setActiveButton] = useState<Direction | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const directionRef = useRef<Direction>(direction);
  const gameStateRef = useRef<GameState>(gameState);
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Position>(food);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameBoardRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);

  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);

  // Detect orientation and screen size
  useEffect(() => {
    const checkLayout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsDesktop(w >= 768);
      setIsLandscape(w > h && w < 1024);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    window.addEventListener('orientationchange', checkLayout);
    return () => {
      window.removeEventListener('resize', checkLayout);
      window.removeEventListener('orientationchange', checkLayout);
    };
  }, []);

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

    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      setGameState('gameover');
      triggerHaptic();
      return;
    }

    if (currentSnake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
      setGameState('gameover');
      triggerHaptic();
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
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault();
          if (currentDir !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          if (currentDir !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault();
          if (currentDir !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault();
          if (currentDir !== 'LEFT') setDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame, togglePause]);

  // Swipe controls on game board only
  useEffect(() => {
    const board = gameBoardRef.current;
    if (!board) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent scroll while swiping on game board
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 20;

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

    board.addEventListener('touchstart', handleTouchStart, { passive: true });
    board.addEventListener('touchmove', handleTouchMove, { passive: false });
    board.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      board.removeEventListener('touchstart', handleTouchStart);
      board.removeEventListener('touchmove', handleTouchMove);
      board.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleDirectionButton = (dir: Direction) => {
    if (gameStateRef.current !== 'playing') return;
    const currentDir = directionRef.current;
    const opposites: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    if (dir !== opposites[currentDir]) {
      setDirection(dir);
      triggerHaptic();
    }
  };

  const handleButtonPress = (dir: Direction) => {
    setActiveButton(dir);
    handleDirectionButton(dir);
  };

  const handleButtonRelease = () => {
    setActiveButton(null);
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

  // Direction arrow component for D-pad
  const DirectionButton = ({ dir, label, children }: { dir: Direction; label: string; children: React.ReactNode }) => (
    <button
      onTouchStart={(e) => { e.preventDefault(); handleButtonPress(dir); }}
      onTouchEnd={(e) => { e.preventDefault(); handleButtonRelease(); }}
      onMouseDown={() => handleButtonPress(dir)}
      onMouseUp={handleButtonRelease}
      onMouseLeave={handleButtonRelease}
      className={`
        w-full aspect-square rounded-2xl border-2 flex items-center justify-center
        text-white text-2xl sm:text-3xl font-bold
        transition-all duration-75 select-none
        ${activeButton === dir
          ? 'bg-green-500/50 border-green-400 scale-95 shadow-lg shadow-green-500/30'
          : 'bg-white/10 border-white/20 active:bg-green-500/40 active:border-green-400 active:scale-95'
        }
      `}
      aria-label={label}
      style={{ touchAction: 'none', minWidth: '56px', minHeight: '56px' }}
    >
      {children}
    </button>
  );

  // Game Board Component
  const GameBoard = () => (
    <div
      ref={gameBoardRef}
      className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-900/80 border-2 border-white/10 shadow-2xl shadow-purple-500/10"
      style={{ touchAction: 'none' }}
    >
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.06]">
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
        <div className="w-[78%] h-[78%] bg-gradient-to-br from-red-400 to-pink-500 rounded-full shadow-lg shadow-red-500/50" />
      </div>

      {/* Snake */}
      {snake.map((segment, index) => {
        const isHead = index === 0;
        const opacity = 1 - (index / snake.length) * 0.35;
        return (
          <div
            key={index}
            className={`absolute transition-all duration-[60ms] ${isHead ? 'z-10' : ''}`}
            style={{
              left: `${segment.x * cellSize}%`,
              top: `${segment.y * cellSize}%`,
              width: `${cellSize}%`,
              height: `${cellSize}%`,
              opacity,
            }}
          >
            <div
              className={`w-[88%] h-[88%] mx-auto mt-[6%] rounded-[3px] sm:rounded-md ${
                isHead
                  ? 'bg-gradient-to-br from-green-300 to-emerald-500 shadow-md shadow-green-500/40'
                  : 'bg-gradient-to-br from-green-400 to-emerald-600'
              }`}
            />
          </div>
        );
      })}

      {/* Swipe hint (only on mobile, when idle) */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
          <div className="text-5xl sm:text-6xl mb-3 animate-bounce">🐍</div>
          <h2 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">{t.title}</h2>
          <p className="text-purple-200/80 text-[11px] sm:text-sm mb-4 sm:mb-5 text-center px-6 max-w-[280px] leading-relaxed">
            {t.useArrows}
          </p>
          <button
            onClick={resetGame}
            className="px-7 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 active:scale-95 transition-all duration-150 text-sm sm:text-base"
          >
            {t.play}
          </button>
        </div>
      )}

      {/* PAUSED Overlay */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
          <div className="text-4xl sm:text-5xl mb-3">⏸️</div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{t.paused}</h2>
          <button
            onClick={togglePause}
            className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all duration-150 text-sm sm:text-base"
          >
            {t.resume}
          </button>
        </div>
      )}

      {/* GAME OVER Overlay */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-[2px] z-20">
          <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">💀</div>
          <h2 className="text-xl sm:text-2xl font-bold text-red-300 mb-1">{t.gameOver}</h2>
          <p className="text-white text-sm sm:text-lg mb-0.5">
            {t.score}: <span className="font-bold text-green-300">{score}</span>
          </p>
          {score >= highScore && score > 0 && (
            <p className="text-yellow-300 text-xs sm:text-sm mb-2 animate-pulse">{t.newRecord}</p>
          )}
          {!(score >= highScore && score > 0) && <div className="h-5" />}
          <button
            onClick={resetGame}
            className="mt-2 sm:mt-3 px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 active:scale-95 transition-all duration-150 text-sm sm:text-base"
          >
            {t.restart}
          </button>
        </div>
      )}
    </div>
  );

  // D-Pad Component
  const DPad = () => (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 w-[160px] sm:w-[200px] mx-auto">
      <div />
      <DirectionButton dir="UP" label="Up">
        <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </DirectionButton>
      <div />
      <DirectionButton dir="LEFT" label="Left">
        <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </DirectionButton>
      <div className="flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-white/10 border border-white/20" />
      </div>
      <DirectionButton dir="RIGHT" label="Right">
        <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </DirectionButton>
      <div />
      <DirectionButton dir="DOWN" label="Down">
        <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </DirectionButton>
      <div />
    </div>
  );

  // Score bar component
  const ScoreBar = () => (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl p-2 sm:p-2.5 border border-white/10">
        <p className="text-[9px] sm:text-[10px] text-purple-300/80 uppercase tracking-wider font-semibold truncate">{t.score}</p>
        <p className="text-lg sm:text-xl font-bold text-white tabular-nums leading-tight mt-0.5">{score}</p>
      </div>
      <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl p-2 sm:p-2.5 border border-white/10">
        <p className="text-[9px] sm:text-[10px] text-yellow-300/80 uppercase tracking-wider font-semibold truncate">{t.highScore}</p>
        <p className="text-lg sm:text-xl font-bold text-yellow-200 tabular-nums leading-tight mt-0.5">{highScore}</p>
      </div>
      <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl p-2 sm:p-2.5 border border-white/10">
        <p className="text-[9px] sm:text-[10px] text-emerald-300/80 uppercase tracking-wider font-semibold truncate">{t.difficulty}</p>
        <p className="text-xs sm:text-sm font-bold text-emerald-200 truncate leading-tight mt-0.5">{getDifficultyLabel(difficulty)}</p>
      </div>
    </div>
  );

  // PORTRAIT LAYOUT (mobile)
  const PortraitLayout = () => (
    <div className="flex flex-col items-center w-full max-w-md mx-auto gap-3 px-3">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <h1 className="text-xl font-bold text-white flex items-center gap-1.5">
          <span className="text-2xl">🐍</span>
          <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
            {t.title}
          </span>
        </h1>
        <div className="flex items-center gap-1.5">
          {/* Language */}
          <div className="relative">
            <button
              onClick={() => { setShowLangMenu(!showLangMenu); setShowSettings(false); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-sm transition-all border border-white/10"
            >
              <span className="text-base">{languageFlags[language]}</span>
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-40 bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden min-w-[170px] animate-fade-in">
                  <div className="p-2 border-b border-white/10">
                    <p className="text-[10px] text-purple-300 font-semibold px-2 uppercase tracking-wider">{t.language}</p>
                  </div>
                  <div className="p-1.5 max-h-[50vh] overflow-y-auto">
                    {languageCodes.map(code => (
                      <button
                        key={code}
                        onClick={() => { setLanguage(code); setShowLangMenu(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                          language === code
                            ? 'bg-green-500/20 text-green-300'
                            : 'text-white/80 hover:bg-white/10 active:bg-white/15'
                        }`}
                      >
                        <span className="text-lg">{languageFlags[code]}</span>
                        <span className="font-medium">{getLanguageName(code)}</span>
                        {language === code && (
                          <svg className="w-4 h-4 ml-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          {/* Settings */}
          <button
            onClick={() => { setShowSettings(!showSettings); setShowLangMenu(false); }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white transition-all border border-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Score */}
      <ScoreBar />

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-full bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 border border-white/10 animate-fade-in">
          <p className="text-[11px] text-purple-200/80 mb-2 font-semibold uppercase tracking-wider">{t.selectDifficulty}</p>
          <div className="flex gap-2">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 ${
                  difficulty === d
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25'
                    : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80'
                }`}
              >
                {getDifficultyLabel(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Game Board */}
      <GameBoard />

      {/* Action buttons + D-Pad */}
      <div className="w-full flex flex-col items-center gap-3">
        {/* Pause / Restart row */}
        {(gameState === 'playing' || gameState === 'paused') && (
          <div className="flex gap-2 w-full max-w-[200px]">
            {gameState === 'playing' && (
              <button
                onClick={togglePause}
                className="flex-1 py-2.5 bg-white/10 active:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-1.5"
              >
                ⏸️ {t.pause}
              </button>
            )}
            <button
              onClick={resetGame}
              className="flex-1 py-2.5 bg-white/10 active:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-1.5"
            >
              🔄 {t.restart}
            </button>
          </div>
        )}

        {/* D-Pad */}
        <DPad />

        {/* Swipe hint */}
        <p className="text-[10px] text-purple-300/40 text-center">
          {t.swipeToMove}
        </p>
      </div>
    </div>
  );

  // LANDSCAPE LAYOUT (mobile)
  const LandscapeLayout = () => (
    <div className="flex flex-row items-stretch w-full h-[100dvh] px-2 py-1 gap-2 overflow-hidden">
      {/* Left side: Board + Scores */}
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0 min-h-0 justify-center py-1">
        {/* Compact header */}
        <div className="flex items-center justify-between w-full px-1 shrink-0">
          <h1 className="text-sm font-bold text-white flex items-center gap-1">
            <span className="text-lg">🐍</span>
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowLangMenu(!showLangMenu); setShowSettings(false); }}
              className="p-1.5 rounded-lg bg-white/10 text-white text-xs transition-all active:bg-white/20"
            >
              {languageFlags[language]}
            </button>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowLangMenu(false); }}
              className="p-1.5 rounded-lg bg-white/10 text-white transition-all active:bg-white/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compact scores */}
        <div className="flex gap-1.5 w-full px-1 shrink-0">
          <div className="flex-1 bg-white/[0.07] rounded-lg px-2 py-1 border border-white/10">
            <p className="text-[8px] text-purple-300/70 uppercase font-semibold">{t.score}</p>
            <p className="text-sm font-bold text-white tabular-nums leading-tight">{score}</p>
          </div>
          <div className="flex-1 bg-white/[0.07] rounded-lg px-2 py-1 border border-white/10">
            <p className="text-[8px] text-yellow-300/70 uppercase font-semibold">{t.highScore}</p>
            <p className="text-sm font-bold text-yellow-200 tabular-nums leading-tight">{highScore}</p>
          </div>
        </div>

        {/* Game Board - constrained to available height */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0 py-1">
          <div style={{ height: '100%', aspectRatio: '1/1', maxWidth: '100%' }}>
            <GameBoard />
          </div>
        </div>
      </div>

      {/* Right side: Controls */}
      <div className="flex flex-col items-center justify-center gap-2 w-[140px] shrink-0">
        {/* Action buttons */}
        {(gameState === 'playing' || gameState === 'paused') && (
          <div className="flex flex-col gap-1.5 w-full">
            {gameState === 'playing' && (
              <button
                onClick={togglePause}
                className="w-full py-2 bg-white/10 active:bg-white/20 text-white text-[10px] font-semibold rounded-xl border border-white/10 transition-all"
              >
                ⏸️ {t.pause}
              </button>
            )}
            <button
              onClick={resetGame}
              className="w-full py-2 bg-white/10 active:bg-white/20 text-white text-[10px] font-semibold rounded-xl border border-white/10 transition-all"
            >
              🔄 {t.restart}
            </button>
          </div>
        )}

        {/* Compact D-Pad */}
        <div className="grid grid-cols-3 gap-1.5 w-[120px]">
          <div />
          <DirectionButton dir="UP" label="Up">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </DirectionButton>
          <div />
          <DirectionButton dir="LEFT" label="Left">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </DirectionButton>
          <div className="flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white/10 border border-white/20" />
          </div>
          <DirectionButton dir="RIGHT" label="Right">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </DirectionButton>
          <div />
          <DirectionButton dir="DOWN" label="Down">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </DirectionButton>
          <div />
        </div>

        {/* Difficulty selector in landscape */}
        <div className="flex flex-col gap-1 w-full">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all active:scale-95 ${
                difficulty === d
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {getDifficultyLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Language menu overlay for landscape */}
      {showLangMenu && (
        <>
          <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setShowLangMenu(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden min-w-[200px] animate-fade-in">
            <div className="p-2 border-b border-white/10">
              <p className="text-[10px] text-purple-300 font-semibold px-2 uppercase tracking-wider">{t.language}</p>
            </div>
            <div className="p-1.5 max-h-[60vh] overflow-y-auto">
              {languageCodes.map(code => (
                <button
                  key={code}
                  onClick={() => { setLanguage(code); setShowLangMenu(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    language === code
                      ? 'bg-green-500/20 text-green-300'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">{languageFlags[code]}</span>
                  <span className="font-medium">{getLanguageName(code)}</span>
                  {language === code && (
                    <svg className="w-4 h-4 ml-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
  );

  // DESKTOP LAYOUT
  const DesktopLayout = () => (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto gap-4 px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <span className="text-3xl">🐍</span>
          <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
            {t.title}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          {/* Language */}
          <div className="relative">
            <button
              onClick={() => { setShowLangMenu(!showLangMenu); setShowSettings(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition-all border border-white/10"
            >
              <span className="text-lg">{languageFlags[language]}</span>
              <span className="text-xs font-medium">{getLanguageName(language)}</span>
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-40 bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden min-w-[190px] animate-fade-in">
                  <div className="p-2 border-b border-white/10">
                    <p className="text-[10px] text-purple-300 font-semibold px-2 uppercase tracking-wider">{t.language}</p>
                  </div>
                  <div className="p-1.5 max-h-[50vh] overflow-y-auto">
                    {languageCodes.map(code => (
                      <button
                        key={code}
                        onClick={() => { setLanguage(code); setShowLangMenu(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                          language === code
                            ? 'bg-green-500/20 text-green-300'
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-lg">{languageFlags[code]}</span>
                        <span className="font-medium">{getLanguageName(code)}</span>
                        {language === code && (
                          <svg className="w-4 h-4 ml-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          {/* Settings */}
          <button
            onClick={() => { setShowSettings(!showSettings); setShowLangMenu(false); }}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all border border-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Score */}
      <ScoreBar />

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-full bg-white/[0.07] backdrop-blur-sm rounded-xl p-4 border border-white/10 animate-fade-in">
          <p className="text-xs text-purple-200/80 mb-2 font-semibold uppercase tracking-wider">{t.selectDifficulty}</p>
          <div className="flex gap-2">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  difficulty === d
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25'
                    : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80'
                }`}
              >
                {getDifficultyLabel(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Game Board */}
      <GameBoard />

      {/* Action buttons */}
      <div className="flex gap-3 w-full">
        {gameState === 'playing' && (
          <button
            onClick={togglePause}
            className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
          >
            ⏸️ {t.pause}
          </button>
        )}
        {(gameState === 'playing' || gameState === 'paused') && (
          <button
            onClick={resetGame}
            className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
          >
            🔄 {t.restart}
          </button>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="flex justify-center flex-wrap gap-4 text-xs text-purple-300/50">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] border border-white/10">↑↓←→</kbd>
          <span>{t.keyboardHint.split(':')[1]?.trim() || t.keyboardHint}</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] border border-white/10">Space</kbd>
          <span>{t.spaceHint.split(':')[1]?.trim() || t.spaceHint}</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] border border-white/10">Enter</kbd>
          <span>{t.enterHint.split(':')[1]?.trim() || t.enterHint}</span>
        </span>
      </div>
    </div>
  );

  // Responsive layout selection
  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center select-none overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {isDesktop ? <DesktopLayout /> : (isLandscape ? <LandscapeLayout /> : <PortraitLayout />)}
    </div>
  );
}
