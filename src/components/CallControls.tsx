import {
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Terminal,
  Video,
  VideoOff,
} from 'lucide-react';

interface CallControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  showLogs: boolean;
  showChat: boolean;
  unreadChatCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleLogs: () => void;
  onToggleChat: () => void;
  onLeave: () => void;
}

/** 通话控制栏只抛出用户意图，由上层决定具体行为。 */
export function CallControls({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  showLogs,
  showChat,
  unreadChatCount,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleLogs,
  onToggleChat,
  onLeave,
}: CallControlsProps) {
  return (
    <div className="controls-dock">
      <button
        className={`control-btn ${audioEnabled ? 'active' : 'off'}`}
        onClick={onToggleAudio}
        title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
      >
        {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      <button
        className={`control-btn ${videoEnabled ? 'active' : 'off'}`}
        onClick={onToggleVideo}
        title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
      >
        {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      <button
        className={`control-btn ${isScreenSharing ? 'active' : ''}`}
        onClick={onToggleScreenShare}
        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
      >
        <Monitor size={20} />
      </button>

      <button
        className={`control-btn ${showLogs ? 'active' : ''}`}
        onClick={onToggleLogs}
        title="Signaling & DataChannel Logs"
      >
        <Terminal size={20} />
      </button>

      <button
        className={`control-btn chat-control ${showChat ? 'active' : ''}`}
        onClick={onToggleChat}
        title="WebRTC P2P DataChannel Chat"
      >
        <MessageSquare size={20} />
        {unreadChatCount > 0 && !showChat && (
          <span className="unread-badge">{unreadChatCount}</span>
        )}
      </button>

      <button className="control-btn hangup" onClick={onLeave} title="Leave Call">
        <PhoneOff size={20} />
      </button>
    </div>
  );
}
