import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
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

interface SyncMessage {
  type: 'sync-request' | 'sync-response' | 'stroke' | 'clear';
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

// Generate a peer ID that includes room info for discovery
const generatePeerId = (roomId: string) => {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `mppaint-${roomId}-${randomPart}`;
};

export function useRoom(roomId: string | null) {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [myPeerId] = useState(() => crypto.randomUUID());
  const [myColor] = useState(() => generatePeerColor());

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const ydocRef = useRef<Y.Doc | null>(null);
  const ystrokesRef = useRef<Y.Array<DrawStroke> | null>(null);

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

    // Create PeerJS peer with unique ID
    const peerId = generatePeerId(roomId);
    const peer = new Peer(peerId, {
      // Use PeerJS free cloud server
      debug: 0,
    });
    peerRef.current = peer;

    const handleConnection = (conn: DataConnection) => {
      conn.on('open', () => {
        connectionsRef.current.set(conn.peer, conn);
        setPeers(prev => {
          const next = new Map(prev);
          next.set(conn.peer, { id: conn.peer, color: generatePeerColor() });
          return next;
        });

        // Send our current state to new peer
        const state = Y.encodeStateAsUpdate(ydoc);
        conn.send({ type: 'sync-response', data: Array.from(state) } as SyncMessage);
      });

      conn.on('data', (data: unknown) => {
        const msg = data as SyncMessage;
        if (msg.type === 'sync-response') {
          Y.applyUpdate(ydoc, new Uint8Array(msg.data as number[]));
        } else if (msg.type === 'stroke') {
          const stroke = msg.data as DrawStroke;
          if (!ystrokes.toArray().find(s => s.id === stroke.id)) {
            ystrokes.push([stroke]);
          }
        } else if (msg.type === 'clear') {
          ystrokes.delete(0, ystrokes.length);
        }
      });

      conn.on('close', () => {
        connectionsRef.current.delete(conn.peer);
        setPeers(prev => {
          const next = new Map(prev);
          next.delete(conn.peer);
          return next;
        });
      });
    };

    peer.on('open', () => {
      setConnected(true);

      // Try to connect to other peers in the same room
      // We use a naming convention: mppaint-{roomId}-{random}
      // The host is the one with the lexicographically smallest ID
      // Other peers connect to peers they discover
    });

    peer.on('connection', handleConnection);

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
    });

    // Discovery: try to connect to potential hosts
    // Since we can't list peers, we use a "room host" concept
    // The first peer in a room acts as the host
    const hostId = `mppaint-${roomId}-host`;

    // If we're not the host, try connecting to the host
    if (peerId !== hostId) {
      // Wait for peer to be ready
      peer.on('open', () => {
        const conn = peer.connect(hostId, { reliable: true });
        if (conn) {
          handleConnection(conn);
        }
      });
    }

    // Also try to become the host if available
    const hostPeer = new Peer(hostId, { debug: 0 });

    hostPeer.on('open', () => {
      // We successfully registered as host
      console.log('Registered as room host');
    });

    hostPeer.on('connection', (conn) => {
      // Forward to main peer's connection handler
      handleConnection(conn);
    });

    hostPeer.on('error', (err) => {
      // Host ID already taken - that's fine, someone else is host
      if (err.type === 'unavailable-id') {
        console.log('Room host exists, connecting as client');
      }
    });

    return () => {
      ystrokes.unobserve(observer);
      connectionsRef.current.forEach(conn => conn.close());
      connectionsRef.current.clear();
      peer.destroy();
      hostPeer.destroy();
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

    // Broadcast to all connected peers
    const msg: SyncMessage = { type: 'stroke', data: fullStroke };
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }, [myPeerId]);

  const clearCanvas = useCallback(() => {
    const ystrokes = ystrokesRef.current;
    if (ystrokes) {
      ystrokes.delete(0, ystrokes.length);
    }

    // Broadcast clear to all peers
    const msg: SyncMessage = { type: 'clear' };
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send(msg);
      }
    });
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
