import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_GAP = 14;
const CARD_WIDTH = (width - 32 * 2 - CARD_GAP) / 2;

const GAMES = [
  { id: 'pickleball', name: 'Pickleball', icon: '🏓', color: '#6366F1', available: true },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐', color: '#F59E0B', available: true },
  { id: 'badminton', name: 'Badminton', icon: '🏸', color: '#10B981', available: true },
];

export const GameSelectScreen = ({ navigation }) => {
  const handleSelectGame = (game) => {
    navigation.navigate('Start', { gameType: game.name, gameId: game.id });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a Sport</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>AVAILABLE</Text>
        <View style={styles.grid}>
          {GAMES.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={[styles.card, { borderColor: game.color + '40' }]}
              onPress={() => handleSelectGame(game)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: game.color + '18' }]}>
                <Text style={styles.icon}>{game.icon}</Text>
              </View>
              <Text style={styles.cardName}>{game.name}</Text>
              <View style={[styles.badge, { backgroundColor: game.color }]}>
                <Text style={styles.badgeText}>Play</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.card, styles.comingSoonCard]}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
              <Text style={styles.icon}>+</Text>
            </View>
            <Text style={[styles.cardName, { color: '#64748B' }]}>More Sports</Text>
            <View style={[styles.badge, { backgroundColor: '#334155' }]}>
              <Text style={styles.badgeText}>Coming Soon</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            1. Select a sport above{'\n'}
            2. Enter team names{'\n'}
            3. Point your camera at the game{'\n'}
            4. Let AI handle the calls
          </Text>
        </View>
      </ScrollView>
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
  scrollContent: {
    padding: 32,
    paddingTop: 24,
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginBottom: 32,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  comingSoonCard: {
    borderColor: 'rgba(100,116,139,0.2)',
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
  },
  cardName: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
  },
  infoTitle: {
    color: '#C7D2FE',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 22,
  },
});
