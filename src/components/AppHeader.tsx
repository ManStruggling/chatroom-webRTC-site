import { Check, Copy, Sparkles } from 'lucide-react';
import type { ConnectionStatus } from '../hooks/useWebRTC';

interface AppHeaderProps {
  inRoom: boolean;
  roomId: string;
  copied: boolean;
  connectionStatus: ConnectionStatus;
  isDataChannelReady: boolean;
  onCopyLink: () => void;
}

const getStatusText = (status: ConnectionStatus, isDataChannelReady: boolean) => {
  if (status === 'connected') {
    return isDataChannelReady ? 'P2P + DataChannel Active' : 'Media Connected';
  }
  return status === 'connecting' ? 'Handshake...' : 'Waiting Peer';
};

/** 顶部品牌栏及当前房间的连接状态。 */
export function AppHeader({
  inRoom,
  roomId,
  copied,
  connectionStatus,
  isDataChannelReady,
  onCopyLink,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Sparkles size={20} color="#fff" />
        </div>
        <span className="brand-title">WebRTC P2P DataChannel Video</span>
      </div>

      {inRoom && (
        <div className="header-room-info">
          <div className="room-badge">
            Room: <span className="room-id-highlight">{roomId}</span>
            <button className="copy-btn" onClick={onCopyLink} title="Copy Invite Link">
              {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            </button>
          </div>
          <div className={`status-pill ${connectionStatus}`}>
            <span className="status-dot" />
            {getStatusText(connectionStatus, isDataChannelReady)}
          </div>
        </div>
      )}
    </header>
  );
}
