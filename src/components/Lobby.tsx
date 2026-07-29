import type { FormEvent } from 'react';
import { Video } from 'lucide-react';

interface LobbyProps {
  username: string;
  roomId: string;
  onUsernameChange: (value: string) => void;
  onRoomIdChange: (value: string) => void;
  onGenerateRoom: () => void;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
}

/** 加入房间前的业务表单，不感知任何 WebRTC 实现细节。 */
export function Lobby({
  username,
  roomId,
  onUsernameChange,
  onRoomIdChange,
  onGenerateRoom,
  onJoin,
}: LobbyProps) {
  return (
    <main className="lobby-container">
      <div className="lobby-card">
        <div className="lobby-header">
          <h2>Join P2P Video Room</h2>
          <p>
            Video streams and chat messages are pushed directly <b>Peer-to-Peer</b> using WebRTC
            MediaStreams and RTCDataChannel.
          </p>
        </div>

        <form onSubmit={onJoin} className="lobby-form">
          <div className="form-group">
            <label htmlFor="username">Your Display Name</label>
            <input
              id="username"
              type="text"
              className="input-field"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="e.g. Peer Alpha"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="room-id">Room ID</label>
            <div className="room-input-row">
              <input
                id="room-id"
                type="text"
                className="input-field"
                value={roomId}
                onChange={(event) => onRoomIdChange(event.target.value)}
                placeholder="e.g. room-alpha-123"
                required
              />
              <button type="button" className="btn-secondary" onClick={onGenerateRoom}>
                Random
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            <Video size={20} />
            Enter P2P Room
          </button>
        </form>
      </div>
    </main>
  );
}
