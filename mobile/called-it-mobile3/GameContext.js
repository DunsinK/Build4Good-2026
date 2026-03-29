import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GameContext = createContext();

const HISTORY_KEY = '@fairplay_game_history';

export const GameProvider = ({ children }) => {
  const [currentGame, setCurrentGame] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [lastCall, setLastCall] = useState(null);
  const [ballPosition, setBallPosition] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(HISTORY_KEY);
        if (stored) {
          setGameHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Failed to load game history:', e);
      }
    })();
  }, []);

  const persistHistory = async (history) => {
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to persist game history:', e);
    }
  };

  const startGame = (team1Name, team2Name, gameType = 'Pickleball') => {
    setCurrentGame({
      id: Date.now().toString(),
      gameType,
      team1: { name: team1Name, score: 0 },
      team2: { name: team2Name, score: 0 },
      startTime: new Date().toISOString(),
      endTime: null,
      isActive: true,
    });
    setCallHistory([]);
    setLastCall(null);
    setBallPosition(null);
  };

  const endGame = () => {
    if (currentGame) {
      const completed = {
        ...currentGame,
        endTime: new Date().toISOString(),
        isActive: false,
        calls: [...callHistory],
      };
      const updated = [completed, ...gameHistory];
      setGameHistory(updated);
      persistHistory(updated);
      setCurrentGame(null);
      setCallHistory([]);
      setLastCall(null);
      setBallPosition(null);
    }
  };

  const deleteGame = (gameId) => {
    const updated = gameHistory.filter((g) => g.id !== gameId);
    setGameHistory(updated);
    persistHistory(updated);
  };

  const clearHistory = () => {
    setGameHistory([]);
    persistHistory([]);
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
      timestamp: new Date().toISOString(),
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
        deleteGame,
        clearHistory,
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
