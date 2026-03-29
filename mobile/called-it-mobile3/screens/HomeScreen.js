import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export const HomeScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(buttonFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.background}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.titleBlock,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.logo}>FP</Text>
          <Text style={styles.title}>Fair Play</Text>
          <Text style={styles.subtitle}>AI-Powered Sports Referee</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>
            Real-time scoring, instant calls, and game history — all from your phone.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.buttonContainer, { opacity: buttonFade }]}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('GameSelect')}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.7}
          >
            <Text style={styles.historyLinkText}>View Game History</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E1A',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -width * 0.4,
    left: -width * 0.3,
  },
  circle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    bottom: -width * 0.2,
    right: -width * 0.2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: '#6366F1',
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: '#6366F1',
    borderRadius: 2,
    marginVertical: 20,
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historyLink: {
    marginTop: 20,
    paddingVertical: 10,
  },
  historyLinkText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '600',
  },
});
