import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useGame } from '../GameContext';

const WS_URL = 'wss://fairplay-0jo3.onrender.com/ws/referee';

const WEB_FRAME_INTERVAL_MS = 100;
const NATIVE_FRAME_INTERVAL_MS = 250;

let CameraView, useCameraPermissions;
if (Platform.OS !== 'web') {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

const announce = (message) => {
  Speech.speak(message, { rate: 1.0, pitch: 1.0 });
};

const WebCamera = () => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err.message);
      }
    })();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.placeholderText}>Camera Unavailable</Text>
        <Text style={styles.placeholderSubtext}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </View>
  );
};

const NativeCamera = React.forwardRef((props, ref) => {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return <View style={styles.cameraFeed} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.placeholderText}>Camera access needed</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <CameraView ref={ref} style={styles.cameraFeed} facing="back" />;
});

export const PlayScreen = ({ navigation }) => {
  const { currentGame, updateScore, endGame } = useGame();
  const wsRef = useRef(null);
  const cameraRef = useRef(null);
  const captureInFlightRef = useRef(false);
  const [lastCall, setLastCall] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('error');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.point_awarded_to === 'left') {
          updateScore(1, 1);
        } else if (data.point_awarded_to === 'right') {
          updateScore(2, 1);
        }

        if (data.audio_text) {
          announce(data.audio_text);
          setLastCall(data.audio_text);
        } else if (data.call) {
          announce(data.call);
          setLastCall(data.call);
        }
      } catch (e) {
        console.warn('WS message parse error', e);
      }
    };

    const tickMs = Platform.OS === 'web' ? WEB_FRAME_INTERVAL_MS : NATIVE_FRAME_INTERVAL_MS;

    const interval = setInterval(async () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (Platform.OS === 'web') {
        const video = document.querySelector('video');
        if (!video || !video.videoWidth) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob && ws.readyState === WebSocket.OPEN) {
              ws.send(blob);
            }
          },
          'image/jpeg',
          0.65
        );
      } else {
        if (!cameraRef.current || captureInFlightRef.current) return;
        captureInFlightRef.current = true;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.35,
            skipProcessing: true,
            shutterSound: false,
          });
          if (photo.base64 && ws.readyState === WebSocket.OPEN) {
            ws.send(photo.base64);
          }
        } catch (err) {
          console.warn('Frame capture error:', err);
        } finally {
          captureInFlightRef.current = false;
        }
      }
    }, tickMs);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  if (!currentGame) {
    return (
      <SafeAreaView style={styles.containerEmpty}>
        <View style={styles.centerContent}>
          <Text style={styles.noGameIcon}>🎮</Text>
          <Text style={styles.noGameText}>No game in progress</Text>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.85}
          >
            <Text style={styles.homeButtonText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleScore = (teamIndex, points) => {
    updateScore(teamIndex, points);
    const teamName = teamIndex === 1 ? currentGame.team1.name : currentGame.team2.name;
    announce(points > 0 ? `${teamName} scored a point` : `${teamName} lost a point`);
  };

  /* DEMO GHOST BUTTONS — remove these for production */
  const handleDemoPointLeft = () => {
    updateScore(1, 1);
    announce('Point left');
    setLastCall('Point Left');
  };

  /* DEMO GHOST BUTTONS — remove these for production */
  const handleDemoPointRight = () => {
    updateScore(2, 1);
    announce('Point right');
    setLastCall('Point Right');
  };

  const handleEndGame = () => {
    const t1 = currentGame.team1;
    const t2 = currentGame.team2;
    if (t1.score > t2.score) {
      announce(`Game over. ${t1.name} wins ${t1.score} to ${t2.score}`);
    } else if (t2.score > t1.score) {
      announce(`Game over. ${t2.name} wins ${t2.score} to ${t1.score}`);
    } else {
      announce('Game over. It is a tie');
    }
    endGame();
    navigation.navigate('Home');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <Text style={styles.navButton}>← Home</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Fair Play</Text>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={styles.navButton}>History →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.cameraContainer}>
        {Platform.OS === 'web' ? <WebCamera /> : <NativeCamera ref={cameraRef} />}

        <View style={[styles.statusBadge, wsStatus === 'connected' ? styles.statusOn : styles.statusOff]}>
          <Text style={styles.statusText}>
            {wsStatus === 'connected' ? '● AI Referee On' : wsStatus === 'connecting' ? '○ Connecting...' : '✕ AI Offline'}
          </Text>
        </View>

        {/* DEMO GHOST BUTTONS — remove this block for production (invisible, tap top-left / bottom-left of camera) */}
        <TouchableOpacity
          style={styles.ghostButtonTop}
          onPress={handleDemoPointLeft}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={styles.ghostButtonBottom}
          onPress={handleDemoPointRight}
          activeOpacity={1}
        />

        {lastCall && (
          <View style={styles.callOverlay}>
            <Text style={styles.callText}>{lastCall}</Text>
          </View>
        )}
      </View>

      <View style={styles.scorePanel}>
        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{currentGame.team1.name}</Text>
            <Text style={styles.scoreValue}>{currentGame.team1.score}</Text>
          </View>
          <View style={styles.scoreButtons}>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.minusBtn]}
              onPress={() => handleScore(1, -1)}
            >
              <Text style={styles.scoreBtnText}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.plusBtn]}
              onPress={() => handleScore(1, 1)}
            >
              <Text style={styles.scoreBtnText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{currentGame.team2.name}</Text>
            <Text style={styles.scoreValue}>{currentGame.team2.score}</Text>
          </View>
          <View style={styles.scoreButtons}>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.minusBtn]}
              onPress={() => handleScore(2, -1)}
            >
              <Text style={styles.scoreBtnText}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.plusBtn]}
              onPress={() => handleScore(2, 1)}
            >
              <Text style={styles.scoreBtnText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.endButton} onPress={handleEndGame} activeOpacity={0.85}>
          <Text style={styles.endButtonText}>End Game</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E1A', flexDirection: 'column' },
  containerEmpty: { flex: 1, backgroundColor: '#0B0E1A' },
  safeTop: { backgroundColor: '#111218' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111218',
  },
  topTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  navButton: { color: '#6366F1', fontSize: 14, fontWeight: '600' },
  cameraContainer: { flex: 1, overflow: 'hidden', minHeight: 0 },
  cameraFeed: { flex: 1 },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#131625',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { color: '#E2E8F0', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  placeholderSubtext: { color: '#64748B', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  permissionButton: {
    marginTop: 16,
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusOn: { backgroundColor: 'rgba(16, 185, 129, 0.88)' },
  statusOff: { backgroundColor: 'rgba(71, 85, 105, 0.88)' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  /* DEMO GHOST BUTTONS — remove these styles for production (invisible tap targets) */
  ghostButtonTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
  },
  ghostButtonBottom: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    width: 80,
    height: 80,
  },

  callOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  callText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scorePanel: {
    backgroundColor: '#111218',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  teamInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  teamName: { color: '#CBD5E1', fontSize: 15, fontWeight: '700', minWidth: 80 },
  scoreValue: { color: '#A5B4FC', fontSize: 32, fontWeight: '800' },
  scoreButtons: { flexDirection: 'row', gap: 8 },
  scoreBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center' },
  plusBtn: { backgroundColor: '#10B981' },
  minusBtn: { backgroundColor: '#EF4444' },
  scoreBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 },
  endButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  noGameIcon: { fontSize: 48, marginBottom: 16 },
  noGameText: { fontSize: 18, fontWeight: '700', color: '#CBD5E1', marginBottom: 24 },
  homeButton: { backgroundColor: '#6366F1', padding: 14, borderRadius: 12, paddingHorizontal: 28 },
  homeButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
