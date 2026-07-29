import type { FormEvent } from 'react';
import { useCallback, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { CallControls } from './components/CallControls';
import { ChatDrawer } from './components/ChatDrawer';
import { Lobby } from './components/Lobby';
import { LogDrawer } from './components/LogDrawer';
import { VideoStage } from './components/VideoStage';
import { useWebRTC } from './hooks/useWebRTC';
import './App.css';

export function App() {
  // 页面业务状态：房间表单和抽屉显隐不属于 WebRTC hook。
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || '';
  });
  const [username, setUsername] = useState(() => `User_${Math.floor(1000 + Math.random() * 9000)}`);
  const [copied, setCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const handleIncomingMessage = useCallback(() => {
    if (!showChat) setUnreadChatCount((count) => count + 1);
  }, [showChat]);

  const {
    localVideoRef,
    remoteVideoRef,
    connectionStatus,
    remotePeerId,
    remoteUsername,
    isDataChannelReady,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    remoteAudioEnabled,
    remoteVideoEnabled,
    logs,
    messages,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendMessage,
  } = useWebRTC({ username, onMessageReceived: handleIncomingMessage });

  const handleJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetRoom = roomId.trim() || 'default-room';
    setRoomId(targetRoom);
    setInRoom(true);
    const joined = await joinRoom(targetRoom);
    if (!joined) {
      alert('Could not access camera or microphone. Please check browser permissions.');
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setInRoom(false);
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}?room=${encodeURIComponent(roomId)}`;
    void navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (!sendMessage(text)) {
      alert('P2P DataChannel is not open yet. Wait for P2P connection to be established.');
      return;
    }
    setChatInput('');
  };

  const generateRandomRoom = () => {
    const randomCode = 'room-' + Math.random().toString(36).substring(2, 8);
    setRoomId(randomCode);
  };

  const toggleLogs = () => {
    setShowLogs((visible) => !visible);
    setShowChat(false);
  };

  const toggleChat = () => {
    setShowChat((visible) => !visible);
    setShowLogs(false);
    setUnreadChatCount(0);
  };

  return (
    <div className="app-container">
      <AppHeader
        inRoom={inRoom}
        roomId={roomId}
        copied={copied}
        connectionStatus={connectionStatus}
        isDataChannelReady={isDataChannelReady}
        onCopyLink={handleCopyLink}
      />

      {!inRoom ? (
        <Lobby
          username={username}
          roomId={roomId}
          onUsernameChange={setUsername}
          onRoomIdChange={setRoomId}
          onGenerateRoom={generateRandomRoom}
          onJoin={handleJoinRoom}
        />
      ) : (
        <div className="video-room-container">
          <VideoStage
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            connectionStatus={connectionStatus}
            roomId={roomId}
            username={username}
            copied={copied}
            remotePeerId={remotePeerId}
            remoteUsername={remoteUsername}
            isDataChannelReady={isDataChannelReady}
            remoteAudioEnabled={remoteAudioEnabled}
            remoteVideoEnabled={remoteVideoEnabled}
            onCopyLink={handleCopyLink}
          />
          <CallControls
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            isScreenSharing={isScreenSharing}
            showLogs={showLogs}
            showChat={showChat}
            unreadChatCount={unreadChatCount}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            onToggleLogs={toggleLogs}
            onToggleChat={toggleChat}
            onLeave={handleLeaveRoom}
          />
          {showLogs && (
            <LogDrawer logs={logs} onClose={() => setShowLogs(false)} />
          )}
          {showChat && (
            <ChatDrawer
              messages={messages}
              username={username}
              input={chatInput}
              isReady={isDataChannelReady}
              onInputChange={setChatInput}
              onSend={handleSendMessage}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
