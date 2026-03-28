import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useGame } from '../GameContext';

export const HistoryScreen = ({ navigation }) => {
  const { gameHistory } = useGame();

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return '0:00';
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const GameCard = ({ game }) => {
    const winner =
      game.team1.score > game.team2.score
        ? game.team1.name
        : game.team1.score < game.team2.score
          ? game.team2.name
          : 'Tie';

    return (
      <View style={styles.gameCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDate(game.startTime)}</Text>
          <Text style={styles.durationText}>Duration: {calculateDuration(game.startTime, game.endTime)}</Text>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.teamScore}>
            <Text style={styles.teamNameText}>{game.team1.name}</Text>
            <Text style={styles.scoreTextLarge}>{game.team1.score}</Text>
          </View>

          <Text style={styles.vsText}>vs</Text>

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
                winner === 'Tie' ? '#666' : winner === game.team1.name ? '#4CAF50' : '#FF9800',
            },
          ]}
        >
          <Text style={styles.winnerText}>
            {winner === 'Tie' ? 'Tied Game' : `${winner} Won`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Play')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Game History</Text>
        <View style={{ width: 40 }} />
      </View>

      {gameHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>📊 No games recorded yet</Text>
          <Text style={styles.emptySubtext}>Start a game to see history here</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.gamesList}>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  gamesList: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  gameCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 10,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 5,
  },
  durationText: {
    fontSize: 11,
    color: '#999',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 12,
  },
  teamScore: {
    alignItems: 'center',
    flex: 1,
  },
  teamNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  scoreTextLarge: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  vsText: {
    marginHorizontal: 10,
    fontSize: 14,
    color: '#999',
  },
  winnerBadge: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  winnerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
  },
});
