import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useGame } from '../GameContext';

const GAME_META = {
  pickleball: { icon: '🏓', color: '#6366F1' },
  volleyball: { icon: '🏐', color: '#F59E0B' },
  badminton:  { icon: '🏸', color: '#10B981' },
};

export const StartScreen = ({ navigation, route }) => {
  const gameType = route?.params?.gameType || 'Pickleball';
  const gameId = route?.params?.gameId || 'pickleball';
  const meta = GAME_META[gameId] || GAME_META.pickleball;

  const [team1, setTeam1] = useState('Team 1');
  const [team2, setTeam2] = useState('Team 2');
  const { currentGame, startGame } = useGame();

  const handleStart = () => {
    startGame(team1, team2, gameType);
    navigation.navigate('Play');
  };

  const handleResume = () => {
    navigation.navigate('Play');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('GameSelect')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fair Play</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.gameBadge, { backgroundColor: meta.color + '18' }]}>
          <Text style={styles.gameBadgeIcon}>{meta.icon}</Text>
          <Text style={[styles.gameBadgeText, { color: meta.color }]}>{gameType}</Text>
        </View>

        {currentGame && (
          <View style={styles.gameAlert}>
            <Text style={styles.alertText}>Game in Progress</Text>
            <Text style={styles.alertSubtext}>
              {currentGame.team1.name} vs {currentGame.team2.name}
            </Text>
          </View>
        )}

        {!currentGame && (
          <View style={styles.inputSection}>
            <Text style={styles.label}>Team 1</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter team name"
              value={team1}
              onChangeText={setTeam1}
              placeholderTextColor="#475569"
              selectionColor={meta.color}
            />

            <Text style={styles.label}>Team 2</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter team name"
              value={team2}
              onChangeText={setTeam2}
              placeholderTextColor="#475569"
              selectionColor={meta.color}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: meta.color }]}
          onPress={currentGame ? handleResume : handleStart}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {currentGame ? 'Resume Game' : 'Start Game'}
          </Text>
        </TouchableOpacity>

        <View style={styles.featuresBox}>
          <Text style={styles.featuresTitle}>What to expect</Text>
          <View style={styles.featureRow}>
            <Text style={styles.featureDot}>●</Text>
            <Text style={styles.featureItem}>AI watches your game in real-time</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureDot}>●</Text>
            <Text style={styles.featureItem}>Automatic scoring and voice calls</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureDot}>●</Text>
            <Text style={styles.featureItem}>Manual score adjustments available</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  gameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    marginBottom: 28,
    gap: 8,
  },
  gameBadgeIcon: {
    fontSize: 22,
  },
  gameBadgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  gameAlert: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  alertText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  alertSubtext: {
    fontSize: 13,
    color: '#6EE7B7',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    fontSize: 16,
    color: '#E2E8F0',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  featuresBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featuresTitle: {
    fontWeight: '700',
    marginBottom: 14,
    color: '#CBD5E1',
    fontSize: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  featureDot: {
    color: '#6366F1',
    fontSize: 8,
  },
  featureItem: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
});
