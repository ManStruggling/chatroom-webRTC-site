import { useCallback, useEffect, useRef, useState } from 'react';
import { RTC_CONFIG } from '../config/webrtc';
import { socket } from '../services/socket';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'offer' | 'answer' | 'candidate' | 'error' | 'datachannel';
  text: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
}

interface UseWebRTCOptions {
  username: string;
  onMessageReceived?: (message: ChatMessage) => void;
}

const createId = () => crypto.randomUUID();

/**
 * 封装一对一 WebRTC 会话。
 *
 * Socket 只负责 SDP/ICE 信令交换；音视频和聊天数据均通过 WebRTC P2P 传输。
 * 页面组件只需要调用 joinRoom/leaveRoom 和媒体控制方法，无需管理底层连接对象。
 */
export function useWebRTC({ username, onMessageReceived }: UseWebRTCOptions) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  // Socket 监听器只注册一次，使用 ref 获取最新的组件参数，避免闭包陈旧。
  const usernameRef = useRef(username);
  const onMessageReceivedRef = useRef(onMessageReceived);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [remoteUsername, setRemoteUsername] = useState('Remote Peer');
  const [isDataChannelReady, setIsDataChannelReady] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const audioEnabledRef = useRef(audioEnabled);
  const videoEnabledRef = useRef(videoEnabled);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: createId(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type,
      text,
    };
    setLogs((previous) => [...previous.slice(-49), entry]);
  }, []);

  const publishMediaStatus = useCallback((audio: boolean, video: boolean) => {
    const channel = dataChannelRef.current;
    if (channel?.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'media-status', audioEnabled: audio, videoEnabled: video }));
    }
  }, []);

  const closePeerConnection = useCallback(() => {
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    pendingCandidatesRef.current = [];

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemotePeerId(null);
    setConnectionStatus('disconnected');
    setIsDataChannelReady(false);
  }, []);

  const stopScreenSharing = useCallback(() => {
    const screenTrack = screenTrackRef.current;
    if (!screenTrack) return;

    screenTrack.onended = null;
    screenTrack.stop();
    screenTrackRef.current = null;

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    const videoSender = peerConnectionRef.current
      ?.getSenders()
      .find((sender) => sender.track?.kind === 'video');

    if (videoSender && cameraTrack) {
      void videoSender.replaceTrack(cameraTrack).catch((error: unknown) => {
        addLog(`Failed to restore camera track: ${String(error)}`, 'error');
      });
    }
    setIsScreenSharing(false);
    addLog('Stopped screen sharing');
  }, [addLog]);

  const setupDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      channel.onopen = () => {
        setIsDataChannelReady(true);
        addLog('WebRTC P2P DataChannel opened', 'datachannel');
        publishMediaStatus(audioEnabledRef.current, videoEnabledRef.current);
      };
      channel.onclose = () => {
        setIsDataChannelReady(false);
        addLog('WebRTC P2P DataChannel closed', 'datachannel');
      };
      channel.onerror = () => addLog('WebRTC DataChannel error', 'error');
      channel.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as Record<string, unknown>;
          if (data.type === 'chat') {
            const message: ChatMessage = {
              id: String(data.id),
              senderId: String(data.senderId),
              senderName: String(data.senderName),
              message: String(data.message),
              timestamp: String(data.timestamp),
            };
            setMessages((previous) => [...previous, message]);
            onMessageReceivedRef.current?.(message);
            addLog(`[P2P] Received message from ${message.senderName}`, 'datachannel');
          } else if (data.type === 'media-status') {
            setRemoteAudioEnabled(Boolean(data.audioEnabled));
            setRemoteVideoEnabled(Boolean(data.videoEnabled));
          }
        } catch (error) {
          addLog(`Failed to parse DataChannel message: ${String(error)}`, 'error');
        }
      };
    },
    [addLog, publishMediaStatus],
  );

  const createPeerConnection = useCallback(
    (targetSocketId: string, isInitiator: boolean) => {
      // 一对一场景中，新连接建立前先关闭旧连接，避免残留 sender 和事件监听。
      closePeerConnection();
      const connection = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = connection;
      setRemotePeerId(targetSocketId);
      setConnectionStatus('connecting');
      addLog(`Creating RTCPeerConnection for ${targetSocketId}`);

      localStreamRef.current?.getTracks().forEach((track) => {
        connection.addTrack(track, localStreamRef.current!);
      });

      if (isInitiator) {
        const channel = connection.createDataChannel('chatChannel', { ordered: true });
        dataChannelRef.current = channel;
        setupDataChannel(channel);
      } else {
        connection.ondatachannel = ({ channel }) => {
          dataChannelRef.current = channel;
          setupDataChannel(channel);
        };
      }

      connection.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        socket.emit('ice-candidate', { targetSocketId, candidate });
        addLog(`Generated ICE candidate for ${targetSocketId}`, 'candidate');
      };
      connection.ontrack = ({ track, streams }) => {
        if (remoteVideoRef.current && streams[0]) remoteVideoRef.current.srcObject = streams[0];
        addLog(`Received remote ${track.kind} track`);
      };
      connection.onconnectionstatechange = () => {
        const { connectionState } = connection;
        addLog(
          `Peer connection state: ${connectionState}`,
          connectionState === 'failed' ? 'error' : 'info',
        );
        if (connectionState === 'connected') setConnectionStatus('connected');
        else if (connectionState === 'connecting') setConnectionStatus('connecting');
        else if (['disconnected', 'failed', 'closed'].includes(connectionState)) {
          setConnectionStatus('disconnected');
          setIsDataChannelReady(false);
        }
      };

      return connection;
    },
    [addLog, closePeerConnection, setupDataChannel],
  );

  const flushPendingCandidates = useCallback(async (connection: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current.splice(0);
    for (const candidate of candidates) {
      await connection.addIceCandidate(candidate);
    }
  }, []);

  useEffect(() => {
    const handleConnect = () => addLog('Connected to signaling server');
    const handleAllUsers = async (users: { socketId: string; username: string }[]) => {
      const peer = users[0];
      if (!peer) {
        addLog('No existing peer in room');
        return;
      }

      setRemoteUsername(peer.username);
      const connection = createPeerConnection(peer.socketId, true);
      try {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        socket.emit('offer', {
          targetSocketId: peer.socketId,
          offer,
          callerName: usernameRef.current,
        });
        addLog(`Sent SDP offer to ${peer.username}`, 'offer');
      } catch (error) {
        addLog(`Failed to create offer: ${String(error)}`, 'error');
      }
    };
    const handleUserJoined = (peer: { socketId: string; username: string }) => {
      setRemotePeerId(peer.socketId);
      setRemoteUsername(peer.username);
      setConnectionStatus('connecting');
      addLog(`${peer.username} joined the room`);
    };
    const handleOffer = async ({
      offer,
      callerSocketId,
      callerName,
    }: {
      offer: RTCSessionDescriptionInit;
      callerSocketId: string;
      callerName: string;
    }) => {
      setRemoteUsername(callerName);
      const connection = createPeerConnection(callerSocketId, false);
      try {
        await connection.setRemoteDescription(offer);
        await flushPendingCandidates(connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        socket.emit('answer', { targetSocketId: callerSocketId, answer });
        addLog(`Sent SDP answer to ${callerName}`, 'answer');
      } catch (error) {
        addLog(`Failed to process offer: ${String(error)}`, 'error');
      }
    };
    const handleAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const connection = peerConnectionRef.current;
      if (!connection) return;
      try {
        await connection.setRemoteDescription(answer);
        await flushPendingCandidates(connection);
        addLog('Applied remote SDP answer', 'answer');
      } catch (error) {
        addLog(`Failed to process answer: ${String(error)}`, 'error');
      }
    };
    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const connection = peerConnectionRef.current;
      if (!connection?.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await connection.addIceCandidate(candidate);
        addLog('Added remote ICE candidate', 'candidate');
      } catch (error) {
        addLog(`Failed to add ICE candidate: ${String(error)}`, 'error');
      }
    };
    const handleUserLeft = ({ username: peerName }: { username: string }) => {
      addLog(`${peerName || 'Remote peer'} left the room`);
      closePeerConnection();
    };

    socket.on('connect', handleConnect);
    socket.on('all-users', handleAllUsers);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('all-users', handleAllUsers);
      socket.off('user-joined', handleUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.disconnect();
      closePeerConnection();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [addLog, closePeerConnection, createPeerConnection, flushPendingCandidates]);

  const joinRoom = useCallback(
    async (roomId: string) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // leaveRoom 会断开 Socket；再次加入时先恢复信令连接，emit 会由 Socket.IO 缓冲。
        if (!socket.connected) socket.connect();
        socket.emit('join-room', { roomId, username: usernameRef.current });
        addLog(`Joined room "${roomId}" as "${usernameRef.current}"`);
        return true;
      } catch (error) {
        addLog(`Failed to access media devices: ${String(error)}`, 'error');
        return false;
      }
    },
    [addLog],
  );

  const leaveRoom = useCallback(() => {
    stopScreenSharing();
    closePeerConnection();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    // 服务端以 disconnecting 事件清理房间，因此主动断开才能正确通知对端。
    socket.disconnect();
    setAudioEnabled(true);
    setVideoEnabled(true);
  }, [closePeerConnection, stopScreenSharing]);

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    const next = !audioEnabledRef.current;
    track.enabled = next;
    audioEnabledRef.current = next;
    setAudioEnabled(next);
    publishMediaStatus(next, videoEnabledRef.current);
  }, [publishMediaStatus]);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !videoEnabledRef.current;
    track.enabled = next;
    videoEnabledRef.current = next;
    setVideoEnabled(next);
    publishMediaStatus(audioEnabledRef.current, next);
  }, [publishMediaStatus]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenSharing();
      return;
    }

    const connection = peerConnectionRef.current;
    if (!connection) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      const videoSender = connection.getSenders().find((sender) => sender.track?.kind === 'video');
      if (!videoSender) {
        screenTrack.stop();
        return;
      }
      await videoSender.replaceTrack(screenTrack);
      screenTrackRef.current = screenTrack;
      screenTrack.onended = stopScreenSharing;
      setIsScreenSharing(true);
      addLog('Started screen sharing');
    } catch (error) {
      addLog(`Screen sharing failed: ${String(error)}`, 'error');
    }
  }, [addLog, isScreenSharing, stopScreenSharing]);

  const sendMessage = useCallback(
    (text: string) => {
      const channel = dataChannelRef.current;
      if (channel?.readyState !== 'open') return false;

      const message: ChatMessage = {
        id: createId(),
        senderId: socket.id || 'local',
        senderName: usernameRef.current,
        message: text,
        timestamp: new Date().toISOString(),
      };
      channel.send(JSON.stringify({ type: 'chat', ...message }));
      setMessages((previous) => [...previous, message]);
      addLog(`[P2P] Sent message: "${text}"`, 'datachannel');
      return true;
    },
    [addLog],
  );

  return {
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
  };
}
