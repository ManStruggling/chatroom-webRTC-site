import { io, Socket } from 'socket.io-client';

// Dev: talk to local signaling server. Prod: same origin (Express serves the SPA).
const SIGNALING_SERVER_URL =
  import.meta.env.VITE_SIGNALING_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

export const socket: Socket = io(SIGNALING_SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
