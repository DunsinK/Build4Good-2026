import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useGame, Game } from '@/context/GameContext';

export default function HistoryScreen() {
  const { gameHistory } = useGame();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (start: Date | null, end: Date | null) => {
    if (!start || !end) return '0:00';
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const GameCard = ({ game }: { game: Game }) => {
    const winner =
      game.team1.score > game.team2.score
        ? game.team1.name
        : game.team1.score < game.team2.score
          ? game.team2.name
          : 'Tie';

    return (
      <ThemedView
        style={[
          styles.gameCard,
          { borderColor: isDark ? '#444' : '#ddd', backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9' },
        ]}
      >
        {/* Header with date */}
        <ThemedView style={styles.cardHeader}>
          <ThemedText type="small" style={styles.dateText}>
            {formatDate(game.startTime)}
          </ThemedText>
          <ThemedText
            type="small"
            style={[styles.durationText, { color: isDark ? '#888' : '#666' }]}
          >
            Duration: {calculateDuration(game.startTime, game.endTime)}
          </ThemedText>
        </ThemedView>

        {/* Scores */}
        <ThemedView style={styles.scoreRow}>
          <ThemedView style={styles.teamScore}>
            <ThemedText type="defaultSemiBold" style={styles.teamNameText}>
              {game.team1.name}
            </ThemedText>
            <ThemedText type="title" style={styles.scoreTextLarge}>
              {game.team1.score}
            </ThemedText>
          </ThemedView>

          <ThemedText type="default" style={styles.vsText}>
            vs
          </ThemedText>

          <ThemedView style={styles.teamScore}>
            <ThemedText type="defaultSemiBold" style={styles.teamNameText}>
              {game.team2.name}
            </ThemedText>
            <ThemedText type="title" style={styles.scoreTextLarge}>
              {game.team2.score}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Stats Summary */}
        <ThemedView style={styles.statsRow}>
          <StatBadge label="Fouls" team1={game.team1.stats.fouls} team2={game.team2.stats.fouls} />
          <StatBadge
            label="Timeouts"
            team1={game.team1.stats.timeouts}
            team2={game.team2.stats.timeouts}
          />
          <StatBadge
            label="Possession"
            team1={game.team1.stats.possessions}
            team2={game.team2.stats.possessions}
          />
        </ThemedView>

        {/* Winner Badge */}
        <ThemedView
          style={[
            styles.winnerBadge,
            {
              backgroundColor:
                winner === 'Tie'
                  ? isDark
                    ? '#444'
                    : '#ddd'
                  : winner === game.team1.name
                    ? '#4CAF50'
                    : '#FF9800',
            },
          ]}
        >
          <ThemedText type="small" style={{ color: '#fff', fontWeight: '600' }}>
            {winner === 'Tie' ? 'Tied Game' : `${winner} Won`}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <ThemedView style={styles.headerSection}>
          <ThemedText type="title" style={styles.title}>
            Game History
          </ThemedText>
          <ThemedText type="small" style={styles.subtitle}>
            {gameHistory.length} {gameHistory.length === 1 ? 'game' : 'games'}
          </ThemedText>
        </ThemedView>

        {/* Games List */}
        {gameHistory.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText type="defaultSemiBold" style={styles.emptyText}>
              No games recorded yet
            </ThemedText>
            <ThemedText type="small" style={styles.emptySubtext}>
              Start a game from the home screen to see history here
            </ThemedText>
          </ThemedView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.gamesList}>
            {gameHistory.map((game, index) => (
              <GameCard key={game.id || index} game={game} />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const StatBadge = ({ label, team1, team2 }: { label: string; team1: number; team2: number }) => (
  <ThemedView style={styles.statBadge}>
    <ThemedText type="small" style={styles.statBadgeLabel}>
      {label}
    </ThemedText>
    <ThemedText type="defaultSemiBold" style={styles.statBadgeValue}>
      {team1} - {team2}
    </ThemedText>
  </ThemedView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  subtitle: {
    opacity: 0.6,
  },
  gamesList: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  gameCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    marginBottomVertical: Spacing.two,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  cardHeader: {
    marginBottomVertical: Spacing.two,
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  durationText: {
    fontSize: 11,
    marginTop: Spacing.one,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  teamScore: {
    alignItems: 'center',
    flex: 1,
  },
  teamNameText: {
    fontSize: 14,
    marginBottom: Spacing.one,
  },
  scoreTextLarge: {
    fontSize: 32,
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  vsText: {
    opacity: 0.5,
    marginHorizontal: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-around',
    marginVertical: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    opacity: 0.7,
  },
  statBadge: {
    flex: 1,
    alignItems: 'center',
  },
  statBadgeLabel: {
    opacity: 0.6,
    marginBottom: Spacing.one,
  },
  statBadgeValue: {
    fontSize: 14,
  },
  winnerBadge: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  emptySubtext: {
    textAlign: 'center',
    opacity: 0.6,
  },
});
