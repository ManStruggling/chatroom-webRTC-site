import type { RefObject } from 'react';
import { Check, Copy, Users, VideoOff, VolumeX, Zap } from 'lucide-react';
import type { ConnectionStatus } from '../hooks/useWebRTC';

interface VideoStageProps {
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  connectionStatus: ConnectionStatus;
  roomId: string;
  username: string;
  copied: boolean;
  remotePeerId: string | null;
  remoteUsername: string;
  isDataChannelReady: boolean;
  remoteAudioEnabled: boolean;
  remoteVideoEnabled: boolean;
  onCopyLink: () => void;
}

/** 远端主画面、本地预览以及连接等待状态。 */
export function VideoStage({
  localVideoRef,
  remoteVideoRef,
  connectionStatus,
  roomId,
  username,
  copied,
  remotePeerId,
  remoteUsername,
  isDataChannelReady,
  remoteAudioEnabled,
  remoteVideoEnabled,
  onCopyLink,
}: VideoStageProps) {
  const connected = connectionStatus === 'connected';

  return (
    <div className="video-grid">
      <div className="video-card">
        <video ref={remoteVideoRef} autoPlay playsInline />

        {!connected && (
          <div className="waiting-peer-overlay">
            <div className="radar-spinner" />
            <div className="waiting-title">Waiting for Remote Peer</div>
            <div className="waiting-desc">
              Open another browser window or tab and join room{' '}
              <b className="waiting-room-id">{roomId}</b> to complete WebRTC P2P connection.
            </div>
            <button className="btn-secondary invite-button" onClick={onCopyLink}>
              {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              {copied ? 'Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        )}

        {connected && (
          <div className="peer-name-tag" title={`Socket ID: ${remotePeerId || ''}`}>
            <Users size={14} color="var(--accent-cyan)" />
            <span>{remoteUsername}</span>
            {isDataChannelReady && (
              <span title="RTCDataChannel Active">
                <Zap size={14} color="var(--accent-green)" />
              </span>
            )}
            {!remoteAudioEnabled && (
              <span title="Remote Audio Muted">
                <VolumeX size={14} color="var(--accent-red)" />
              </span>
            )}
            {!remoteVideoEnabled && (
              <span title="Remote Video Disabled">
                <VideoOff size={14} color="var(--accent-red)" />
              </span>
            )}
          </div>
        )}
      </div>

      <div className="video-card local-preview">
        <video ref={localVideoRef} autoPlay playsInline muted />
        <div className="peer-name-tag">
          <span>{username} (You)</span>
        </div>
      </div>
    </div>
  );
}
