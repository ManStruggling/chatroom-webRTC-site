import { io, Socket } from 'socket.io-client';

const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

export const socket: Socket = io(SIGNALING_SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
