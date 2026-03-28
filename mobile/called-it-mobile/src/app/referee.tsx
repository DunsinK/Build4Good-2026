/**
 * Referee Screen — Real-time pickleball AI referee.
 *
 * Flow:
 *   1. User grants camera permission
 *   2. User taps "Connect" to open WebSocket to backend
 *   3. User taps "Start Streaming" to begin sending frames
 *   4. Camera captures a low-res snapshot every ~250ms (~4 fps)
 *   5. Each snapshot is base64-encoded and sent as JSON over WebSocket
 *   6. Backend returns a normalised payload after every frame
 *   7. UI displays live tracking info (ball, court, bounces, calls)
 *   8. When audio_text arrives, expo-speech speaks it once
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
  useColorScheme,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRefereeSocket, type RefereePayload } from '@/hooks/use-referee-socket';

const DEFAULT_SERVER = Platform.select({
  android: 'ws://10.0.2.2:8000/ws/referee',
  default: 'ws://localhost:8000/ws/referee',
});

const FRAME_INTERVAL_MS = 250; // ~4 fps

export default function RefereeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [permission, requestPermission] = useCameraPermissions();
  const { connectionState, latestPayload, connect, disconnect, sendFrame } = useRefereeSocket();

  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [streaming, setStreaming] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpokenRef = useRef<string | null>(null);

  // --- Frame capture loop ---
  useEffect(() => {
    if (!streaming || connectionState !== 'connected') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (!cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: true,
          skipProcessing: true,
        });
        if (photo?.base64) {
          sendFrame(photo.base64);
        }
      } catch {
        // Camera not ready or frame dropped — skip silently
      }
    }, FRAME_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [streaming, connectionState, sendFrame]);

  // --- Text-to-speech for point announcements ---
  useEffect(() => {
    if (!latestPayload?.audio_text) return;
    if (latestPayload.audio_text === lastSpokenRef.current) return;

    lastSpokenRef.current = latestPayload.audio_text;
    Speech.speak(latestPayload.audio_text, { rate: 1.0, pitch: 1.0 });
  }, [latestPayload?.audio_text]);

  // --- Reset last-spoken when a new rally starts (tracking after decision) ---
  useEffect(() => {
    if (latestPayload?.type === 'tracking' && lastSpokenRef.current !== null) {
      lastSpokenRef.current = null;
    }
  }, [latestPayload?.type]);

  // --- Handlers ---
  const handleConnect = useCallback(() => {
    if (connectionState === 'connected' || connectionState === 'connecting') {
      setStreaming(false);
      disconnect();
    } else {
      connect(serverUrl);
    }
  }, [connectionState, serverUrl, connect, disconnect]);

  const handleToggleStream = useCallback(() => {
    setStreaming((prev) => !prev);
  }, []);

  // --- Permission gate ---
  if (!permission) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Requesting camera permission...</ThemedText>
      </ThemedView>
    );
  }
  if (!permission.granted) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.mb}>Camera access is required for the referee.</ThemedText>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <ThemedText style={styles.btnText}>Grant Camera Access</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const isConnected = connectionState === 'connected';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex}>
        {/* Camera preview */}
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />

          {/* Floating status badge */}
          <View style={[styles.badge, { backgroundColor: isConnected ? '#4CAF50' : '#f44336' }]}>
            <ThemedText style={styles.badgeText}>
              {connectionState.toUpperCase()}
              {streaming ? ' — LIVE' : ''}
            </ThemedText>
          </View>
        </View>

        {/* Controls + status */}
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
          {/* Server URL input */}
          <View style={styles.row}>
            <TextInput
              style={[styles.urlInput, { color: isDark ? '#fff' : '#000', borderColor: isDark ? '#444' : '#ccc' }]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="ws://host:port/ws/referee"
              placeholderTextColor={isDark ? '#666' : '#999'}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Connect / Stream buttons */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, isConnected ? styles.btnDanger : styles.btnPrimary]}
              onPress={handleConnect}
            >
              <ThemedText style={styles.btnText}>
                {isConnected ? 'Disconnect' : 'Connect'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, streaming ? styles.btnDanger : styles.btnSuccess, !isConnected && styles.btnDisabled]}
              onPress={handleToggleStream}
              disabled={!isConnected}
            >
              <ThemedText style={styles.btnText}>
                {streaming ? 'Stop' : 'Start'} Streaming
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Back button */}
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <ThemedText style={{ color: '#007AFF' }}>Back to Home</ThemedText>
          </TouchableOpacity>

          {/* Live payload display */}
          {latestPayload && <PayloadDisplay payload={latestPayload} isDark={isDark} />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ---------------------------------------------------------------
// Payload display sub-component
// ---------------------------------------------------------------

function PayloadDisplay({ payload, isDark }: { payload: RefereePayload; isDark: boolean }) {
  const callColor =
    payload.call === 'IN' ? '#4CAF50' : payload.call === 'OUT' ? '#f44336' : undefined;

  return (
    <View style={[styles.payloadBox, { borderColor: isDark ? '#333' : '#ddd' }]}>
      <ThemedText type="defaultSemiBold" style={styles.payloadTitle}>
        Referee Status
      </ThemedText>

      <Row label="Type" value={payload.type} />
      <Row label="Frame" value={payload.frame_index?.toString() ?? '—'} />
      <Row label="Ball Detected" value={payload.ball_detected ? 'YES' : 'NO'} />
      <Row
        label="Ball Position"
        value={payload.ball_position ? `(${payload.ball_position.x}, ${payload.ball_position.y})` : '—'}
      />
      <Row label="Court Detected" value={payload.court_detected ? 'YES' : 'NO'} />
      <Row label="Bounce Detected" value={payload.bounce_detected ? 'YES' : 'NO'} />
      <Row label="Call" value={payload.call ?? '—'} valueColor={callColor} />
      <Row label="Confidence" value={payload.confidence.toFixed(2)} />
      <Row
        label="Point"
        value={payload.point_awarded_to?.toUpperCase() ?? '—'}
        valueColor={payload.point_awarded_to ? '#FF6B6B' : undefined}
      />
      <Row
        label="Audio"
        value={payload.audio_text ?? '—'}
        valueColor={payload.audio_text ? '#007AFF' : undefined}
      />
      {payload.message && <Row label="Message" value={payload.message} />}
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.payloadRow}>
      <ThemedText style={styles.payloadLabel}>{label}</ThemedText>
      <ThemedText style={[styles.payloadValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------
// Styles
// ---------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },

  cameraContainer: { height: 280, position: 'relative' },
  camera: { flex: 1 },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  panel: { flex: 1 },
  panelContent: { padding: Spacing.three, gap: Spacing.three },

  row: { flexDirection: 'row', gap: Spacing.two },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 13,
  },

  btn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#007AFF' },
  btnSuccess: { backgroundColor: '#4CAF50' },
  btnDanger: { backgroundColor: '#f44336' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  backLink: { alignSelf: 'center' },
  mb: { marginBottom: Spacing.three },

  payloadBox: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  payloadTitle: { fontSize: 16, marginBottom: Spacing.two },
  payloadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  payloadLabel: { fontSize: 13, opacity: 0.6 },
  payloadValue: { fontSize: 13, fontWeight: '600' },
});
