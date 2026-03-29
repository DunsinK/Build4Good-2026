import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system';

/** ~10 fps — preview snapshots (dev client build; not Expo Go). */
const SNAPSHOT_INTERVAL_MS = 100;
const SNAPSHOT_QUALITY = 68;

/**
 * Streams JPEG frames to the referee backend via `onFrame(base64)`.
 * `video` must be enabled on iOS so `takeSnapshot` can use the video pipeline.
 */
export function LiveVisionCamera({ style, onFrame, isStreaming, isActive = true }) {
  const cameraRef = useRef(null);
  const inFlight = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!isStreaming || !device || !hasPermission || !cameraReady) return;

    const interval = setInterval(async () => {
      if (!cameraRef.current || inFlight.current) return;
      inFlight.current = true;
      try {
        const photo = await cameraRef.current.takeSnapshot({ quality: SNAPSHOT_QUALITY });
        const base64 = await FileSystem.readAsStringAsync(photo.path, {
          encoding: FileSystem.EncodingType.Base64,
        });
        try {
          await FileSystem.deleteAsync(photo.path, { idempotent: true });
        } catch {
          // temp cleanup best-effort
        }
        onFrame?.(base64);
      } catch (err) {
        console.warn('LiveVisionCamera snapshot error:', err?.message ?? err);
      } finally {
        inFlight.current = false;
      }
    }, SNAPSHOT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isStreaming, device, hasPermission, cameraReady, onFrame]);

  if (!hasPermission) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderTitle}>Camera access needed</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderTitle}>No camera found</Text>
      </View>
    );
  }

  return (
    <Camera
      ref={cameraRef}
      style={style}
      device={device}
      isActive={isActive}
      video
      photo={false}
      audio={false}
      onInitialized={() => setCameraReady(true)}
      onError={(e) => console.warn('Camera error', e)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
