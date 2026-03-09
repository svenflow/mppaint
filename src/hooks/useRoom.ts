import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';

export interface PeerInfo {
  id: string;
  color: string;
}

export interface DrawStroke {
  id: string;
  points: [number, number][];
  color: string;
  size: number;
  peerId: string;
}

interface RelayMessage {
  type: 'welcome' | 'peer-count' | 'sync' | 'stroke' | 'clear';
  id?: string;
  count?: number;
  data?: unknown;
}

// Generate a random color for each peer
const generatePeerColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// WebSocket relay server URL
const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'wss://mppaint-relay.nicklaudethorat.workers.dev';

export function useRoom(roomId: string | null) {
  const [connected, setConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [myPeerId] = useState(() => crypto.randomUUID());
  const [myColor] = useState(() => generatePeerColor());

  const wsRef = useRef<WebSocket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ystrokesRef = useRef<Y.Array<DrawStroke> | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Initialize Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const ystrokes = ydoc.getArray<DrawStroke>('strokes');
    ystrokesRef.current = ystrokes;

    // Observe changes to strokes
    const observer = () => {
      setStrokes(ystrokes.toArray());
    };
    ystrokes.observe(observer);

    // Connect to WebSocket relay
    const connect = () => {
      const ws = new WebSocket(`${RELAY_URL}/room/${roomId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to relay');
        setConnected(true);

        // Send our current state to sync with others
        const state = Y.encodeStateAsUpdate(ydoc);
        ws.send(JSON.stringify({
          type: 'sync',
          data: Array.from(state),
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg: RelayMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'welcome':
              console.log('Welcomed with ID:', msg.id);
              break;

            case 'peer-count':
              setPeerCount(msg.count || 1);
              break;

            case 'sync':
              // Apply sync update from another peer
              if (msg.data) {
                Y.applyUpdate(ydoc, new Uint8Array(msg.data as number[]));
              }
              break;

            case 'stroke':
              // Add stroke from another peer
              const stroke = msg.data as DrawStroke;
              if (stroke && !ystrokes.toArray().find(s => s.id === stroke.id)) {
                ystrokes.push([stroke]);
              }
              break;

            case 'clear':
              // Clear canvas
              ystrokes.delete(0, ystrokes.length);
              break;
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from relay');
        setConnected(false);
        wsRef.current = null;

        // Reconnect after a delay
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (roomId) {
            connect();
          }
        }, 2000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      ystrokes.unobserve(observer);
      ydoc.destroy();
      setConnected(false);
      setPeerCount(1);
    };
  }, [roomId]);

  const addStroke = useCallback((stroke: Omit<DrawStroke, 'id' | 'peerId'>) => {
    const fullStroke: DrawStroke = {
      id: crypto.randomUUID(),
      peerId: myPeerId,
      points: stroke.points,
      color: stroke.color,
      size: stroke.size,
    };

    // Add locally to Yjs
    ystrokesRef.current?.push([fullStroke]);

    // Broadcast to relay
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stroke',
        data: fullStroke,
      }));
    }
  }, [myPeerId]);

  const clearCanvas = useCallback(() => {
    const ystrokes = ystrokesRef.current;
    if (ystrokes) {
      ystrokes.delete(0, ystrokes.length);
    }

    // Broadcast clear to relay
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  }, []);

  return {
    connected,
    peers: new Map<string, PeerInfo>(), // We don't track individual peers with relay
    strokes,
    myPeerId,
    myColor,
    addStroke,
    clearCanvas,
    peerCount,
  };
}
