import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Animated,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useGame } from '../GameContext';

let CameraView, useCameraPermissions;
if (Platform.OS !== 'web') {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

const DEFAULT_SERVER = Platform.OS === 'web'
  ? 'ws://localhost:8000/ws/referee'
  : 'ws://10.248.237.238:8000/ws/referee';

const FRAME_INTERVAL_MS = 250; // ~4 fps

// ---------------------------------------------------------------
// Web camera with frame capture
// ---------------------------------------------------------------
const WebCamera = React.forwardRef(({ onFrame }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  React.useImperativeHandle(ref, () => ({
    startCapture: () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        captureFrame();
      }, FRAME_INTERVAL_MS);
    },
    stopCapture: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    },
  }));

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob && onFrame) {
          blob.arrayBuffer().then((buf) => onFrame(buf));
        }
      },
      'image/jpeg',
      0.7,
    );
  }, [onFrame]);

  useEffect(() => {
    let stream = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
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
      if (intervalRef.current) clearInterval(intervalRef.current);
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
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </View>
  );
});

// ---------------------------------------------------------------
// Native camera with frame capture
// ---------------------------------------------------------------
const NativeCamera = React.forwardRef(({ onFrame }, ref) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const intervalRef = useRef(null);

  React.useImperativeHandle(ref, () => ({
    startCapture: () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        captureFrame();
      }, FRAME_INTERVAL_MS);
    },
    stopCapture: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    },
  }));

  const captureFrame = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true,
      });
      if (photo?.base64 && onFrame) {
        onFrame(photo.base64);
      }
    } catch {
      // Camera might be busy, skip frame
    }
  }, [onFrame]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!permission) return <View style={styles.cameraFeed} />;

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

  return <CameraView style={styles.cameraFeed} ref={cameraRef} facing="back" />;
});

// ---------------------------------------------------------------
// Call banner overlay
// ---------------------------------------------------------------
const CallBanner = ({ call, visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, call]);

  if (!call) return null;

  const isOut = call === 'OUT';
  return (
    <Animated.View
      style={[
        styles.callBanner,
        { opacity, backgroundColor: isOut ? 'rgba(244,67,54,0.9)' : 'rgba(76,175,80,0.9)' },
      ]}
    >
      <Text style={styles.callBannerText}>{call}</Text>
    </Animated.View>
  );
};

// ---------------------------------------------------------------
// Announce helper
// ---------------------------------------------------------------
const announce = (message) => {
  Speech.speak(message, { rate: 1.0, pitch: 1.0 });
};

// ---------------------------------------------------------------
// Main PlayScreen
// ---------------------------------------------------------------
export const PlayScreen = ({ navigation }) => {
  const {
    currentGame, updateScore, endGame, awardPoint, addCall,
    wsStatus, setWsStatus, ballPosition, setBallPosition,
  } = useGame();

  const wsRef = useRef(null);
  const cameraRef = useRef(null);
  const reconnectTimer = useRef(null);
  const [showCallBanner, setShowCallBanner] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [frameCount, setFrameCount] = useState(0);

  // ---- Handle server messages ----
  const handleServerMessage = useCallback((data) => {
    if (data.type === 'connected') {
      // Engine ready — start streaming automatically
      cameraRef.current?.startCapture();
      return;
    }

    if (data.type === 'error') return;

    if (data.frame_index) {
      setFrameCount(data.frame_index);
    }

    if (data.ball_position) {
      setBallPosition(data.ball_position);
    } else {
      setBallPosition(null);
    }

    if (data.type === 'tracking' && data.bounce_detected && data.call) {
      setCurrentCall(data.call);
      setShowCallBanner(true);
      addCall({ call: data.call, confidence: data.confidence, type: 'tracking' });
      setTimeout(() => setShowCallBanner(false), 2500);
    }

    if (data.type === 'decision') {
      setCurrentCall(data.call);
      setShowCallBanner(true);
      setTimeout(() => setShowCallBanner(false), 3000);

      addCall({
        call: data.call,
        confidence: data.confidence,
        pointTo: data.point_awarded_to,
        reason: data.message,
        type: 'decision',
      });

      if (data.point_awarded_to) {
        awardPoint(data.point_awarded_to);
        if (data.audio_text) {
          announce(data.audio_text);
        }
      }
    }
  }, [awardPoint, addCall, setBallPosition]);

  // ---- Frame sending ----
  const sendFrame = useCallback((frameData) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (frameData instanceof ArrayBuffer) {
      wsRef.current.send(frameData);
    } else if (typeof frameData === 'string') {
      wsRef.current.send(JSON.stringify({ frame: frameData }));
    }
  }, []);

  // ---- Auto-connect with reconnect ----
  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;

    setWsStatus('connecting');

    const ws = new WebSocket(DEFAULT_SERVER);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch {
        // Not JSON, ignore
      }
    };

    ws.onerror = () => {
      setWsStatus('error');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      cameraRef.current?.stopCapture();
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(() => {
        connectWs();
      }, 3000);
    };

    wsRef.current = ws;
  }, [handleServerMessage]);

  const disconnectWs = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent auto-reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    cameraRef.current?.stopCapture();
    setWsStatus('disconnected');
  }, []);

  // Auto-connect on mount, cleanup on unmount
  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      cameraRef.current?.stopCapture();
    };
  }, []);

  // ---- No game state ----
  if (!currentGame) {
    return (
      <SafeAreaView style={styles.containerLight}>
        <View style={styles.centerContent}>
          <Text style={styles.noGameText}>No game in progress</Text>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.navigate('Start')}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Render ----
  const statusColor = {
    disconnected: '#888',
    connecting: '#FFA000',
    connected: '#4CAF50',
    error: '#f44336',
  }[wsStatus];

  const handleScore = (teamIndex, points) => {
    updateScore(teamIndex, points);
    const teamName = teamIndex === 1 ? currentGame.team1.name : currentGame.team2.name;
    if (points > 0) announce(`${teamName} scored a point`);
  };

  const handleEndGame = () => {
    disconnectWs();
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
    navigation.navigate('Start');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Start')}>
            <Text style={styles.navButton}>Home</Text>
          </TouchableOpacity>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.topTitle}>Called It</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={styles.navButton}>History</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Camera area with overlays */}
      <View style={styles.cameraContainer}>
        {Platform.OS === 'web' ? (
          <WebCamera ref={cameraRef} onFrame={sendFrame} />
        ) : (
          <NativeCamera ref={cameraRef} onFrame={sendFrame} />
        )}

        {/* Ball position indicator */}
        {ballPosition && (
          <View
            style={[
              styles.ballIndicator,
              { left: ballPosition.x - 8, top: ballPosition.y - 8 },
            ]}
          />
        )}

        {/* Call banner */}
        <CallBanner call={currentCall} visible={showCallBanner} />

      </View>

      {/* Score panel */}
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
              <Text style={styles.scoreBtnText}>-1</Text>
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
              <Text style={styles.scoreBtnText}>-1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scoreBtn, styles.plusBtn]}
              onPress={() => handleScore(2, 1)}
            >
              <Text style={styles.scoreBtnText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.endButton} onPress={handleEndGame}>
          <Text style={styles.endButtonText}>End Game</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------
// Styles
// ---------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'column',
  },
  containerLight: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeTop: {
    backgroundColor: '#111',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
    position: 'relative',
  },
  cameraFeed: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  ballIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 235, 59, 0.8)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  callBanner: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  callBannerText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scorePanel: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    flexShrink: 0,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  teamName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 80,
  },
  scoreValue: {
    color: '#FF6B6B',
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  plusBtn: {
    backgroundColor: '#4CAF50',
  },
  minusBtn: {
    backgroundColor: '#f44336',
  },
  scoreBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 4,
  },
  endButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noGameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  homeButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  homeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
