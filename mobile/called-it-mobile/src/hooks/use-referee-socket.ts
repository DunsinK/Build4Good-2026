/**
 * useRefereeSocket — WebSocket hook for the pickleball referee backend.
 *
 * Manages the lifecycle of a single WebSocket connection to /ws/referee,
 * exposes connect/disconnect controls, and provides the latest backend
 * payload to the consuming component.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RefereePayload {
  type: 'connected' | 'tracking' | 'decision' | 'error';
  frame_index: number | null;
  ball_detected: boolean;
  ball_position: { x: number; y: number } | null;
  court_detected: boolean;
  bounce_detected: boolean;
  call: 'IN' | 'OUT' | null;
  point_awarded_to: 'left' | 'right' | null;
  audio_text: string | null;
  confidence: number;
  message: string | null;
}

interface UseRefereeSocketReturn {
  connectionState: ConnectionState;
  latestPayload: RefereePayload | null;
  connect: (serverUrl: string) => void;
  disconnect: () => void;
  sendFrame: (base64Frame: string) => void;
}

const EMPTY_PAYLOAD: RefereePayload = {
  type: 'connected',
  frame_index: null,
  ball_detected: false,
  ball_position: null,
  court_detected: false,
  bounce_detected: false,
  call: null,
  point_awarded_to: null,
  audio_text: null,
  confidence: 0,
  message: null,
};

export function useRefereeSocket(): UseRefereeSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [latestPayload, setLatestPayload] = useState<RefereePayload | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  const connect = useCallback(
    (serverUrl: string) => {
      disconnect();
      setConnectionState('connecting');

      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data: RefereePayload = JSON.parse(event.data);
          setLatestPayload(data);
        } catch {
          setLatestPayload({ ...EMPTY_PAYLOAD, type: 'error', message: 'Failed to parse server message' });
        }
      };

      ws.onerror = () => {
        setConnectionState('error');
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        wsRef.current = null;
      };
    },
    [disconnect],
  );

  const sendFrame = useCallback((base64Frame: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ frame: base64Frame }));
    }
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connectionState, latestPayload, connect, disconnect, sendFrame };
}
