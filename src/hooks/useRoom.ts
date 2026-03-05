import { useState, useEffect, useRef, useCallback } from 'react';
import { joinRoom } from 'trystero/torrent';
import type { Room } from 'trystero/torrent';
import * as Y from 'yjs';

export interface Peer {
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

// Generate a random color for each peer
const generatePeerColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export function useRoom(roomId: string | null) {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [myPeerId] = useState(() => crypto.randomUUID());
  const [myColor] = useState(() => generatePeerColor());

  const roomRef = useRef<Room | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ystrokesRef = useRef<Y.Array<DrawStroke> | null>(null);

  // Actions for sending data - use any to avoid Trystero type constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendStrokeRef = useRef<((stroke: any) => void) | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Initialize Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const ystrokes = ydoc.getArray<DrawStroke>('strokes');
    ystrokesRef.current = ystrokes;

    // Observe changes to strokes
    ystrokes.observe(() => {
      setStrokes(ystrokes.toArray());
    });

    // Join the P2P room via Trystero (BitTorrent DHT)
    const room = joinRoom({ appId: 'mppaint-v1' }, roomId);
    roomRef.current = room;

    // Set up data channels - use any for Trystero compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [sendStroke, getStroke] = room.makeAction<any>('stroke');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [sendSync, getSync] = room.makeAction<any>('sync');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [sendSyncRequest, getSyncRequest] = room.makeAction<any>('sync-request');

    sendStrokeRef.current = sendStroke;

    // Handle incoming strokes
    getStroke((stroke: DrawStroke, _peerId: string) => {
      // Add to Yjs doc (this will trigger observer and update state)
      const ystrokes = ystrokesRef.current;
      if (ystrokes && !ystrokes.toArray().find(s => s.id === stroke.id)) {
        ystrokes.push([stroke]);
      }
    });

    // Handle sync requests (new peer joins)
    getSyncRequest((_requestFlag: boolean, peerId: string) => {
      // Send our current state
      const state = Y.encodeStateAsUpdate(ydoc);
      sendSync(Array.from(state), peerId);
    });

    // Handle incoming sync data
    getSync((update: number[]) => {
      Y.applyUpdate(ydoc, new Uint8Array(update));
    });

    // Peer management
    room.onPeerJoin((peerId) => {
      console.log('Peer joined:', peerId);
      setPeers(prev => {
        const next = new Map(prev);
        next.set(peerId, { id: peerId, color: generatePeerColor() });
        return next;
      });

      // Send our state to new peer
      const state = Y.encodeStateAsUpdate(ydoc);
      sendSync(Array.from(state), peerId);
    });

    room.onPeerLeave((peerId) => {
      console.log('Peer left:', peerId);
      setPeers(prev => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    });

    setConnected(true);

    // Request sync from existing peers after a short delay
    setTimeout(() => {
      sendSyncRequest(true);
    }, 500);

    return () => {
      room.leave();
      ydoc.destroy();
      setConnected(false);
      setPeers(new Map());
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

    // Broadcast to peers
    sendStrokeRef.current?.(fullStroke);
  }, [myPeerId]);

  const clearCanvas = useCallback(() => {
    const ystrokes = ystrokesRef.current;
    if (ystrokes) {
      ystrokes.delete(0, ystrokes.length);
    }
  }, []);

  return {
    connected,
    peers,
    strokes,
    myPeerId,
    myColor,
    addStroke,
    clearCanvas,
    peerCount: peers.size + 1, // +1 for self
  };
}
