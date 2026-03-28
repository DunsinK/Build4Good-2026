import React, { createContext, useState, useContext, useCallback, useRef } from 'react';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [currentGame, setCurrentGame] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected'); // disconnected | connecting | connected | error
  const [lastCall, setLastCall] = useState(null);
  const [ballPosition, setBallPosition] = useState(null);

  const startGame = (team1Name, team2Name) => {
    setCurrentGame({
      id: Date.now().toString(),
      team1: { name: team1Name, score: 0 },
      team2: { name: team2Name, score: 0 },
      startTime: new Date(),
      endTime: null,
      isActive: true,
    });
    setCallHistory([]);
    setLastCall(null);
    setBallPosition(null);
  };

  const endGame = () => {
    if (currentGame) {
      setGameHistory([
        { ...currentGame, endTime: new Date(), isActive: false, calls: [...callHistory] },
        ...gameHistory,
      ]);
      setCurrentGame(null);
      setCallHistory([]);
      setLastCall(null);
      setBallPosition(null);
    }
  };

  const updateScore = (teamIndex, points) => {
    if (!currentGame) return;
    setCurrentGame((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (teamIndex === 1) {
        updated.team1 = { ...prev.team1, score: Math.max(0, prev.team1.score + points) };
      } else {
        updated.team2 = { ...prev.team2, score: Math.max(0, prev.team2.score + points) };
      }
      return updated;
    });
  };

  const awardPoint = useCallback((side) => {
    if (!side) return;
    setCurrentGame((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      // "left" = team1, "right" = team2
      if (side === 'left') {
        updated.team1 = { ...prev.team1, score: prev.team1.score + 1 };
      } else if (side === 'right') {
        updated.team2 = { ...prev.team2, score: prev.team2.score + 1 };
      }
      return updated;
    });
  }, []);

  const addCall = useCallback((call) => {
    const entry = {
      ...call,
      timestamp: new Date(),
    };
    setCallHistory((prev) => [entry, ...prev].slice(0, 50));
    setLastCall(entry);
  }, []);

  return (
    <GameContext.Provider
      value={{
        currentGame,
        gameHistory,
        callHistory,
        wsStatus,
        setWsStatus,
        lastCall,
        ballPosition,
        setBallPosition,
        startGame,
        endGame,
        updateScore,
        awardPoint,
        addCall,
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
