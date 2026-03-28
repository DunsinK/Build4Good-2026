import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface GameStats {
  fouls: number;
  timeouts: number;
  possessions: number;
}

export interface Team {
  name: string;
  score: number;
  stats: GameStats;
}

export interface Game {
  id: string;
  team1: Team;
  team2: Team;
  isActive: boolean;
  startTime: Date | null;
  endTime: Date | null;
  quarter: number;
  timeRemaining: number;
}

interface GameContextType {
  currentGame: Game | null;
  gameHistory: Game[];
  startNewGame: (team1Name: string, team2Name: string) => void;
  endGame: () => void;
  updateScore: (teamIndex: 0 | 1, points: number) => void;
  addFoul: (teamIndex: 0 | 1) => void;
  addTimeout: (teamIndex: 0 | 1) => void;
  incrementPossession: (teamIndex: 0 | 1) => void;
  updateQuarter: (quarter: number) => void;
  updateTimeRemaining: (seconds: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [gameHistory, setGameHistory] = useState<Game[]>([]);

  const startNewGame = (team1Name: string, team2Name: string) => {
    const newGame: Game = {
      id: Date.now().toString(),
      team1: {
        name: team1Name,
        score: 0,
        stats: { fouls: 0, timeouts: 0, possessions: 0 },
      },
      team2: {
        name: team2Name,
        score: 0,
        stats: { fouls: 0, timeouts: 0, possessions: 0 },
      },
      isActive: true,
      startTime: new Date(),
      endTime: null,
      quarter: 1,
      timeRemaining: 600, // 10 minutes in seconds
    };
    setCurrentGame(newGame);
  };

  const endGame = () => {
    if (currentGame) {
      const finishedGame = {
        ...currentGame,
        isActive: false,
        endTime: new Date(),
      };
      setGameHistory([finishedGame, ...gameHistory]);
      setCurrentGame(null);
    }
  };

  const updateScore = (teamIndex: 0 | 1, points: number) => {
    if (!currentGame) return;
    const updatedGame = { ...currentGame };
    const team = teamIndex === 0 ? updatedGame.team1 : updatedGame.team2;
    team.score = Math.max(0, team.score + points);
    setCurrentGame(updatedGame);
  };

  const addFoul = (teamIndex: 0 | 1) => {
    if (!currentGame) return;
    const updatedGame = { ...currentGame };
    const team = teamIndex === 0 ? updatedGame.team1 : updatedGame.team2;
    team.stats.fouls += 1;
    setCurrentGame(updatedGame);
  };

  const addTimeout = (teamIndex: 0 | 1) => {
    if (!currentGame) return;
    const updatedGame = { ...currentGame };
    const team = teamIndex === 0 ? updatedGame.team1 : updatedGame.team2;
    team.stats.timeouts += 1;
    setCurrentGame(updatedGame);
  };

  const incrementPossession = (teamIndex: 0 | 1) => {
    if (!currentGame) return;
    const updatedGame = { ...currentGame };
    const team = teamIndex === 0 ? updatedGame.team1 : updatedGame.team2;
    team.stats.possessions += 1;
    setCurrentGame(updatedGame);
  };

  const updateQuarter = (quarter: number) => {
    if (!currentGame) return;
    setCurrentGame({ ...currentGame, quarter });
  };

  const updateTimeRemaining = (seconds: number) => {
    if (!currentGame) return;
    setCurrentGame({ ...currentGame, timeRemaining: Math.max(0, seconds) });
  };

  return (
    <GameContext.Provider
      value={{
        currentGame,
        gameHistory,
        startNewGame,
        endGame,
        updateScore,
        addFoul,
        addTimeout,
        incrementPossession,
        updateQuarter,
        updateTimeRemaining,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};
