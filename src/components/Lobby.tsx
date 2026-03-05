import { useState, useEffect } from 'react';

interface LobbyProps {
  onJoinRoom: (roomId: string) => void;
}

// Generate a short, shareable room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function Lobby({ onJoinRoom }: LobbyProps) {
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'choice' | 'join'>('choice');

  // Check URL for room code on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      // Auto-join if room in URL
      onJoinRoom(urlRoom.toUpperCase());
    }
  }, [onJoinRoom]);

  const handleCreateRoom = () => {
    const newRoom = generateRoomCode();
    onJoinRoom(newRoom);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      onJoinRoom(roomCode.toUpperCase().trim());
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-container">
        <h1 className="lobby-title">
          <span className="title-emoji">🎨</span>
          mppaint
        </h1>
        <p className="lobby-subtitle">
          multiplayer collaborative canvas
        </p>

        {mode === 'choice' ? (
          <div className="lobby-buttons">
            <button className="lobby-btn create-btn" onClick={handleCreateRoom}>
              Create Room
            </button>
            <button className="lobby-btn join-btn" onClick={() => setMode('join')}>
              Join Room
            </button>
          </div>
        ) : (
          <form className="join-form" onSubmit={handleJoinRoom}>
            <input
              type="text"
              className="room-input"
              placeholder="Enter room code"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
            />
            <div className="join-actions">
              <button
                type="button"
                className="lobby-btn back-btn"
                onClick={() => setMode('choice')}
              >
                Back
              </button>
              <button
                type="submit"
                className="lobby-btn join-btn"
                disabled={!roomCode.trim()}
              >
                Join
              </button>
            </div>
          </form>
        )}

        <p className="lobby-footer">
          P2P · No server · Your drawings stay between friends
        </p>
      </div>
    </div>
  );
}
