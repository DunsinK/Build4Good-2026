import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { useGame } from '../GameContext';

const GAME_ICONS = {
  Pickleball: '🏓',
  Volleyball: '🏐',
  Badminton: '🏸',
};

const confirmDelete = (title, message, onConfirm) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

export const HistoryScreen = ({ navigation }) => {
  const { gameHistory, deleteGame, clearHistory } = useGame();

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return '0:00';
    const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClearAll = () => {
    confirmDelete(
      'Clear All History',
      'This will permanently delete all game records. Are you sure?',
      clearHistory,
    );
  };

  const GameCard = ({ game }) => {
    const winner =
      game.team1.score > game.team2.score
        ? game.team1.name
        : game.team1.score < game.team2.score
          ? game.team2.name
          : 'Tie';

    const icon = GAME_ICONS[game.gameType] || '🎮';

    const handleDelete = () => {
      confirmDelete(
        'Delete Game',
        `Remove this ${game.gameType || 'game'} record?`,
        () => deleteGame(game.id),
      );
    };

    return (
      <View style={styles.gameCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.gameTypeIcon}>{icon}</Text>
            <View>
              <Text style={styles.gameTypeText}>{game.gameType || 'Game'}</Text>
              <Text style={styles.dateText}>{formatDate(game.startTime)}</Text>
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.durationText}>{calculateDuration(game.startTime, game.endTime)}</Text>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.teamScore}>
            <Text style={styles.teamNameText}>{game.team1.name}</Text>
            <Text style={styles.scoreTextLarge}>{game.team1.score}</Text>
          </View>

          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>vs</Text>
          </View>

          <View style={styles.teamScore}>
            <Text style={styles.teamNameText}>{game.team2.name}</Text>
            <Text style={styles.scoreTextLarge}>{game.team2.score}</Text>
          </View>
        </View>

        <View
          style={[
            styles.winnerBadge,
            {
              backgroundColor:
                winner === 'Tie'
                  ? 'rgba(100,116,139,0.2)'
                  : winner === game.team1.name
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(245,158,11,0.15)',
            },
          ]}
        >
          <Text
            style={[
              styles.winnerText,
              {
                color:
                  winner === 'Tie'
                    ? '#94A3B8'
                    : winner === game.team1.name
                      ? '#10B981'
                      : '#F59E0B',
              },
            ]}
          >
            {winner === 'Tie' ? 'Tied Game' : `${winner} Won`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backButton}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        {gameHistory.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {gameHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No games recorded yet</Text>
          <Text style={styles.emptySubtext}>Complete a game to see it here</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('GameSelect')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyButtonText}>Start a Game</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.gamesList} showsVerticalScrollIndicator={false}>
          <Text style={styles.countLabel}>
            {gameHistory.length} game{gameHistory.length !== 1 ? 's' : ''} recorded
          </Text>
          {gameHistory.map((game, index) => (
            <GameCard key={game.id || index} game={game} />
          ))}
        </ScrollView>
      )}
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
  backButton: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearBtn: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  countLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  gamesList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  gameCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gameTypeIcon: {
    fontSize: 24,
  },
  gameTypeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  durationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 8,
  },
  teamScore: {
    alignItems: 'center',
    flex: 1,
  },
  teamNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  scoreTextLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: '#A5B4FC',
  },
  vsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  winnerBadge: {
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  winnerText: {
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
