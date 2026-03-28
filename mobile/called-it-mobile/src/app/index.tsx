import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useGame } from '@/context/GameContext';

export default function HomeScreen() {
  const [team1Name, setTeam1Name] = useState('Team 1');
  const [team2Name, setTeam2Name] = useState('Team 2');
  const { startNewGame, currentGame } = useGame();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleStartGame = () => {
    startNewGame(team1Name, team2Name);
    router.push('/live-game');
  };

  const handleResumeGame = () => {
    router.push('/live-game');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <ThemedView style={styles.headerSection}>
            <ThemedText type="title" style={styles.appTitle}>
              Called It
            </ThemedText>
            <ThemedText type="default" style={styles.subtitle}>
              Referee Control Center
            </ThemedText>
          </ThemedView>

          {/* Current Game Alert */}
          {currentGame && (
            <ThemedView
              style={[
                styles.gameAlertBox,
                { backgroundColor: isDark ? '#1a3a2a' : '#c8e6c9' },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={{ color: isDark ? '#81c784' : '#2e7d32' }}>
                Game in Progress
              </ThemedText>
              <ThemedText type="small" style={{ color: isDark ? '#a5d6a7' : '#558b2f' }}>
                {currentGame.team1.name} vs {currentGame.team2.name}
              </ThemedText>
            </ThemedView>
          )}

          {/* Team Input Section */}
          {!currentGame && (
            <ThemedView style={styles.inputSection}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Create Game
              </ThemedText>

              {/* Team 1 Input */}
              <ThemedView style={styles.inputGroup}>
                <ThemedText type="default" style={styles.label}>
                  Team 1
                </ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: isDark ? '#fff' : '#000', borderColor: isDark ? '#444' : '#ccc' },
                  ]}
                  placeholderTextColor={isDark ? '#888' : '#999'}
                  placeholder="Enter team name"
                  value={team1Name}
                  onChangeText={setTeam1Name}
                />
              </ThemedView>

              {/* Team 2 Input */}
              <ThemedView style={styles.inputGroup}>
                <ThemedText type="default" style={styles.label}>
                  Team 2
                </ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: isDark ? '#fff' : '#000', borderColor: isDark ? '#444' : '#ccc' },
                  ]}
                  placeholderTextColor={isDark ? '#888' : '#999'}
                  placeholder="Enter team name"
                  value={team2Name}
                  onChangeText={setTeam2Name}
                />
              </ThemedView>
            </ThemedView>
          )}

          {/* Action Button */}
          <TouchableOpacity
            onPress={currentGame ? handleResumeGame : handleStartGame}
            style={styles.startButton}
            activeOpacity={0.8}
          >
            <ThemedText type="defaultSemiBold" style={styles.startButtonText}>
              {currentGame ? 'Resume Game' : 'Start Game'}
            </ThemedText>
          </TouchableOpacity>

          {/* Info Section */}
          <ThemedView style={styles.infoBox}>
            <ThemedText type="defaultSemiBold" style={styles.infoTitle}>
              Features
            </ThemedText>
            <ThemedText type="small" style={styles.infoText}>
              ✓ Track live score{'\n'}✓ Record fouls & timeouts{'\n'}✓ Monitor possession changes
              {'\n'}✓ Review game history
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  headerSection: {
    marginBottom: Spacing.four,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  gameAlertBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.four,
  },
  inputSection: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: Spacing.three,
  },
  inputGroup: {
    marginBottom: Spacing.three,
  },
  label: {
    marginBottom: Spacing.one,
    fontSize: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  infoBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#007AFF',
    opacity: 0.7,
  },
  infoTitle: {
    marginBottom: Spacing.two,
    fontSize: 14,
  },
  infoText: {
    lineHeight: 20,
    fontSize: 12,
  },
});
