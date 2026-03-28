import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useGame } from '../GameContext';

export const StartScreen = ({ navigation }) => {
  const [team1, setTeam1] = useState('Team 1');
  const [team2, setTeam2] = useState('Team 2');
  const { currentGame } = useGame();

  const { startGame } = useGame();

  const handleStart = () => {
    startGame(team1, team2);
    navigation.navigate('Play');
  };

  const handleResume = () => {
    navigation.navigate('Play');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Called It</Text>
        <Text style={styles.subtitle}>AI Referee Assistant</Text>
      </View>

      {currentGame && (
        <View style={styles.gameAlert}>
          <Text style={styles.alertText}>📊 Game in Progress</Text>
          <Text style={styles.alertSubtext}>
            {currentGame.team1.name} vs {currentGame.team2.name}
          </Text>
        </View>
      )}

      {!currentGame && (
        <View style={styles.inputSection}>
          <Text style={styles.label}>Team 1 Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter team name"
            value={team1}
            onChangeText={setTeam1}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Team 2 Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter team name"
            value={team2}
            onChangeText={setTeam2}
            placeholderTextColor="#999"
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={currentGame ? handleResume : handleStart}
      >
        <Text style={styles.buttonText}>
          {currentGame ? '▶ Resume Game' : '▶ Start Game'}
        </Text>
      </TouchableOpacity>

      <View style={styles.featuresBox}>
        <Text style={styles.featuresTitle}>✨ Features</Text>
        <Text style={styles.featureItem}>📱 Live Score Tracking</Text>
        <Text style={styles.featureItem}>📷 Camera Integration</Text>
        <Text style={styles.featureItem}>📊 Game History</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  gameAlert: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  alertText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 5,
  },
  alertSubtext: {
    fontSize: 14,
    color: '#558b2f',
  },
  inputSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    color: '#000',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  featuresBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  featuresTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  featureItem: {
    marginBottom: 8,
    color: '#333',
    fontSize: 14,
  },
});
