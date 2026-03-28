import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useGame } from '@/context/GameContext';

export default function LiveGameScreen() {
  const { currentGame, updateScore, addFoul, addTimeout, incrementPossession, endGame } = useGame();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [timeLeft, setTimeLeft] = useState(currentGame?.timeRemaining || 600);

  // Timer effect
  useEffect(() => {
    if (!currentGame?.isActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentGame?.isActive]);

  if (!currentGame) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.noGameText}>
            No Game in Progress
          </ThemedText>
          <TouchableOpacity
            onPress={() => router.push('/')}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>
              Go to Home
            </ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const TeamCard = ({ teamIndex, team }: { teamIndex: 0 | 1; team: typeof currentGame.team1 }) => (
    <ThemedView style={styles.teamCard}>
      <ThemedText type="defaultSemiBold" style={styles.teamName}>
        {team.name}
      </ThemedText>

      {/* Score Display */}
      <ThemedView style={styles.scoreDisplay}>
        <ThemedText type="title" style={styles.scoreNumber}>
          {team.score}
        </ThemedText>
      </ThemedView>

      {/* Score Controls */}
      <ThemedView style={styles.scoreControlGroup}>
        <TouchableOpacity
          style={[styles.controlButton, styles.scoreButton]}
          onPress={() => updateScore(teamIndex, 1)}
          activeOpacity={0.7}
        >
          <ThemedText type="defaultSemiBold" style={styles.controlButtonText}>
            +1
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, styles.scoreButton]}
          onPress={() => updateScore(teamIndex, 2)}
          activeOpacity={0.7}
        >
          <ThemedText type="defaultSemiBold" style={styles.controlButtonText}>
            +2
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, styles.scoreButton]}
          onPress={() => updateScore(teamIndex, 3)}
          activeOpacity={0.7}
        >
          <ThemedText type="defaultSemiBold" style={styles.controlButtonText}>
            +3
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Stats Grid */}
      <ThemedView style={styles.statsGrid}>
        {/* Fouls */}
        <ThemedView style={styles.statCard}>
          <ThemedText type="small" style={styles.statLabel}>
            Fouls
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.statValue}>
            {team.stats.fouls}
          </ThemedText>
          <TouchableOpacity
            style={[styles.miniButton, { backgroundColor: '#ff9800' }]}
            onPress={() => addFoul(teamIndex)}
            activeOpacity={0.7}
          >
            <ThemedText type="small" style={styles.miniButtonText}>
              +1
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Timeouts */}
        <ThemedView style={styles.statCard}>
          <ThemedText type="small" style={styles.statLabel}>
            Timeouts
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.statValue}>
            {team.stats.timeouts}
          </ThemedText>
          <TouchableOpacity
            style={[styles.miniButton, { backgroundColor: '#f44336' }]}
            onPress={() => addTimeout(teamIndex)}
            activeOpacity={0.7}
          >
            <ThemedText type="small" style={styles.miniButtonText}>
              +1
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Possessions */}
        <ThemedView style={styles.statCard}>
          <ThemedText type="small" style={styles.statLabel}>
            Possession
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.statValue}>
            {team.stats.possessions}
          </ThemedText>
          <TouchableOpacity
            style={[styles.miniButton, { backgroundColor: '#9c27b0' }]}
            onPress={() => incrementPossession(teamIndex)}
            activeOpacity={0.7}
          >
            <ThemedText type="small" style={styles.miniButtonText}>
              +1
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Timer and Quarter */}
          <ThemedView style={styles.header}>
            <ThemedView style={styles.timerBox}>
              <ThemedText type="small" style={styles.quarterLabel}>
                Q{currentGame.quarter}
              </ThemedText>
              <ThemedText type="title" style={styles.timer}>
                {formatTime(timeLeft)}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* Team Cards */}
          <View style={styles.tabletLayout}>
            <TeamCard teamIndex={0} team={currentGame.team1} />
            <ThemedView style={styles.divider} />
            <TeamCard teamIndex={1} team={currentGame.team2} />
          </View>

          {/* Control Buttons */}
          <ThemedView style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#f44336' }]}
              onPress={() => {
                endGame();
                router.push('/');
              }}
              activeOpacity={0.7}
            >
              <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                End Game
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#2196f3' }]}
              onPress={() => router.push('/history')}
              activeOpacity={0.7}
            >
              <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                History
              </ThemedText>
            </TouchableOpacity>
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
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    marginBottom: Spacing.four,
    alignItems: 'center',
  },
  timerBox: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  quarterLabel: {
    opacity: 0.7,
    marginBottom: Spacing.one,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  noGameText: {
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  tabletLayout: {
    marginBottom: Spacing.four,
  },
  teamCard: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  teamName: {
    fontSize: 18,
    marginBottom: Spacing.two,
  },
  scoreDisplay: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  scoreControlGroup: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
    justifyContent: 'space-between',
  },
  controlButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
    alignItems: 'center',
  },
  scoreButton: {
    backgroundColor: '#4CAF50',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  statLabel: {
    opacity: 0.7,
    marginBottom: Spacing.one,
  },
  statValue: {
    fontSize: 24,
    marginBottom: Spacing.one,
  },
  miniButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
  },
  miniButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
    opacity: 0.3,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
