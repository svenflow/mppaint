import { useState, useCallback } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { Lobby } from './components/Lobby';
import { useRoom } from './hooks/useRoom';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [color, setColor] = useState('#FFFFFF');
  const [brushSize, setBrushSize] = useState(5);

  const {
    connected,
    strokes,
    addStroke,
    clearCanvas,
    peerCount,
  } = useRoom(roomId);

  const handleJoinRoom = useCallback((newRoomId: string) => {
    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set('room', newRoomId);
    window.history.pushState({}, '', url.toString());
    setRoomId(newRoomId);
  }, []);

  const handleShareRoom = useCallback(() => {
    if (!roomId) return;

    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

    if (navigator.share) {
      navigator.share({
        title: 'Join my mppaint room!',
        text: `Come draw with me! Room: ${roomId}`,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      alert(`Link copied! Share this with friends:\n${url}`);
    }
  }, [roomId]);

  const handleLeaveRoom = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url.toString());
    setRoomId(null);
  }, []);

  // Show lobby if not in a room
  if (!roomId) {
    return <Lobby onJoinRoom={handleJoinRoom} />;
  }

  return (
    <div className="app">
      <div className="header">
        <button className="leave-btn" onClick={handleLeaveRoom}>
          ← Leave
        </button>
        <div className="room-code">
          Room: <span className="code">{roomId}</span>
        </div>
        {!connected && (
          <div className="connecting">Connecting...</div>
        )}
      </div>

      <div className="canvas-container">
        <Canvas
          strokes={strokes}
          color={color}
          brushSize={brushSize}
          onStroke={addStroke}
        />
      </div>

      <Toolbar
        color={color}
        brushSize={brushSize}
        peerCount={peerCount}
        onColorChange={setColor}
        onBrushSizeChange={setBrushSize}
        onClear={clearCanvas}
        onShareRoom={handleShareRoom}
      />
    </div>
  );
}

export default App;
