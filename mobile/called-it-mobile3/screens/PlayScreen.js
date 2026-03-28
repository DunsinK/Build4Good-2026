import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Camera } from 'expo-camera';
import { useGame } from '../GameContext';

export const PlayScreen = ({ navigation }) => {
  const { currentGame, updateScore, endGame } = useGame();
  const [hasPermission, setHasPermission] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (!currentGame) {
    return (
      <SafeAreaView style={styles.container}>
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

  const handleEndGame = () => {
    endGame();
    navigation.navigate('Start');
  };

  const TeamScoreCard = ({ teamIndex, team }) => (
    <View style={styles.teamCard}>
      <Text style={styles.teamName}>{team.name}</Text>
      <View style={styles.scoreBox}>
        <Text style={styles.scoreValue}>{team.score}</Text>
      </View>
      <View style={styles.scoreButtons}>
        <TouchableOpacity
          style={[styles.scoreBtn, styles.scoreBtnSmall]}
          onPress={() => updateScore(teamIndex, 1)}
        >
          <Text style={styles.scoreBtnText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scoreBtn, styles.scoreBtnSmall]}
          onPress={() => updateScore(teamIndex, 2)}
        >
          <Text style={styles.scoreBtnText}>+2</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scoreBtn, styles.scoreBtnSmall]}
          onPress={() => updateScore(teamIndex, 3)}
        >
          <Text style={styles.scoreBtnText}>+3</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera View */}
      {hasPermission && (
        <Camera style={styles.camera} ref={cameraRef} type={Camera.Constants.Type.back} />
      )}

      {/* Score Overlay */}
      <View style={styles.overlay}>
        {/* Header with navigation */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Start')}>
            <Text style={styles.navButton}>← Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={styles.navButton}>History →</Text>
          </TouchableOpacity>
        </View>

        {/* Team Score Cards */}
        <View style={styles.scoreContainer}>
          <TeamScoreCard teamIndex={1} team={currentGame.team1} />
          <View style={styles.divider}>
            <Text style={styles.dividerText}>VS</Text>
          </View>
          <TeamScoreCard teamIndex={2} team={currentGame.team2} />
        </View>

        {/* Bottom action buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.endButton} onPress={handleEndGame}>
            <Text style={styles.endButtonText}>⏹ End Game</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 15,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navButton: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
  },
  teamCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  teamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  scoreBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    justifyContent: 'center',
  },
  scoreBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  scoreBtnSmall: {
    minWidth: 45,
  },
  scoreBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  divider: {
    marginHorizontal: 8,
    marginVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dividerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBar: {
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
