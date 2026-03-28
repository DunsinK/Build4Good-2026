import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useGame } from '../GameContext';

let CameraView, useCameraPermissions;
if (Platform.OS !== 'web') {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

const WebCamera = () => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err.message);
      }
    })();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.placeholderText}>Camera Unavailable</Text>
        <Text style={styles.placeholderSubtext}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </View>
  );
};

const NativeCamera = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  if (!permission) {
    return <View style={styles.cameraFeed} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.placeholderText}>Camera access needed</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <CameraView style={styles.cameraFeed} ref={cameraRef} facing="back" />;
};

const announce = (message) => {
  Speech.speak(message, { rate: 1.0, pitch: 1.0 });
};

export const PlayScreen = ({ navigation }) => {
  const { currentGame, updateScore, endGame } = useGame();

  if (!currentGame) {
    return (
      <SafeAreaView style={styles.containerLight}>
        <View style={styles.centerContent}>
          <Text style={styles.noGameText}>No game in progress</Text>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.navigate('Start')}
          >
            <Text style={styles.homeButtonText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleScore = (teamIndex, points) => {
    updateScore(teamIndex, points);
    const teamName = teamIndex === 1 ? currentGame.team1.name : currentGame.team2.name;
    if (points > 0) {
      announce(`${teamName} scored a point`);
    } else {
      announce(`${teamName} lost a point`);
    }
  };

  const handleEndGame = () => {
    const t1 = currentGame.team1;
    const t2 = currentGame.team2;
    if (t1.score > t2.score) {
      announce(`Game over. ${t1.name} wins ${t1.score} to ${t2.score}`);
    } else if (t2.score > t1.score) {
      announce(`Game over. ${t2.name} wins ${t2.score} to ${t1.score}`);
    } else {
      announce('Game over. It is a tie');
    }
    endGame();
    navigation.navigate('Start');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Start')}>
            <Text style={styles.navButton}>← Home</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Called It</Text>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={styles.navButton}>History →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.cameraContainer}>
        {Platform.OS === 'web' ? <WebCamera /> : <NativeCamera />}
      </View>

      <View style={styles.scorePanel}>
        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{currentGame.team1.name}</Text>
            <Text style={styles.scoreValue}>{currentGame.team1.score}</Text>
          </View>
          <View style={styles.scoreButtons}>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.minusBtn]}
              onPress={() => handleScore(1, -1)}
            >
              <Text style={styles.scoreBtnText}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.plusBtn]}
              onPress={() => handleScore(1, 1)}
            >
              <Text style={styles.scoreBtnText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{currentGame.team2.name}</Text>
            <Text style={styles.scoreValue}>{currentGame.team2.score}</Text>
          </View>
          <View style={styles.scoreButtons}>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.minusBtn]}
              onPress={() => handleScore(2, -1)}
            >
              <Text style={styles.scoreBtnText}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.plusBtn]}
              onPress={() => handleScore(2, 1)}
            >
              <Text style={styles.scoreBtnText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.endButton} onPress={handleEndGame}>
          <Text style={styles.endButtonText}>⏹ End Game</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'column',
  },
  containerLight: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeTop: {
    backgroundColor: '#111',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111',
  },
  topTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  cameraFeed: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  scorePanel: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#333',
    flexShrink: 0,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  teamName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 80,
  },
  scoreValue: {
    color: '#FF6B6B',
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  plusBtn: {
    backgroundColor: '#4CAF50',
  },
  minusBtn: {
    backgroundColor: '#f44336',
  },
  scoreBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 4,
  },
  endButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noGameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  homeButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  homeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
