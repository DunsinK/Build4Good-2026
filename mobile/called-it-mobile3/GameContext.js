import React, { createContext, useState, useContext } from 'react';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [currentGame, setCurrentGame] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);

  const startGame = (team1Name, team2Name) => {
    setCurrentGame({
      id: Date.now().toString(),
      team1: { name: team1Name, score: 0 },
      team2: { name: team2Name, score: 0 },
      startTime: new Date(),
      endTime: null,
      isActive: true,
    });
  };

  const endGame = () => {
    if (currentGame) {
      setGameHistory([{ ...currentGame, endTime: new Date(), isActive: false }, ...gameHistory]);
      setCurrentGame(null);
    }
  };

  const updateScore = (teamIndex, points) => {
    if (!currentGame) return;
    const updatedGame = { ...currentGame };
    if (teamIndex === 1) {
      updatedGame.team1.score += points;
    } else {
      updatedGame.team2.score += points;
    }
    setCurrentGame(updatedGame);
  };

  return (
    <GameContext.Provider value={{ currentGame, gameHistory, startGame, endGame, updateScore }}>
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
