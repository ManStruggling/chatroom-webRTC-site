import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'WebRTC Express Signaling Server', timestamp: new Date().toISOString() });
});

// Serve static frontend assets if build exists
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to SPA index.html for unknown routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/health')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store user mapping: socket.id -> { roomId, username }
const users = new Map();

io.on('connection', (socket) => {
  console.log(`[Signaling Server] Client connected: ${socket.id}`);

  // 1. Peer joins a room
  socket.on('join-room', ({ roomId, username }) => {
    const userDisplayName = username || `User_${socket.id.substring(0, 4)}`;
    users.set(socket.id, { roomId, username: userDisplayName });

    socket.join(roomId);
    console.log(`[Signaling Server] ${userDisplayName} (${socket.id}) joined room: ${roomId}`);

    // Get list of existing users in the room (excluding current user)
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    const existingUsers = [];

    if (roomSockets) {
      roomSockets.forEach((id) => {
        if (id !== socket.id) {
          const userMeta = users.get(id);
          existingUsers.push({
            socketId: id,
            username: userMeta ? userMeta.username : id,
          });
        }
      });
    }

    // Send list of existing room members to new peer
    socket.emit('all-users', existingUsers);

    // Notify other peers in room about new peer
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      username: userDisplayName,
    });
  });

  // 2. WebRTC SDP Offer relay (Only for WebRTC Handshake)
  socket.on('offer', ({ targetSocketId, offer, callerName }) => {
    console.log(`[Signaling Server] Relaying SDP Offer from ${socket.id} to ${targetSocketId}`);
    io.to(targetSocketId).emit('offer', {
      offer,
      callerSocketId: socket.id,
      callerName: callerName || users.get(socket.id)?.username || 'Peer',
    });
  });

  // 3. WebRTC SDP Answer relay (Only for WebRTC Handshake)
  socket.on('answer', ({ targetSocketId, answer }) => {
    console.log(`[Signaling Server] Relaying SDP Answer from ${socket.id} to ${targetSocketId}`);
    io.to(targetSocketId).emit('answer', {
      answer,
      responderSocketId: socket.id,
    });
  });

  // 4. WebRTC ICE Candidate relay (Only for WebRTC Handshake)
  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    console.log(`[Signaling Server] Relaying ICE Candidate from ${socket.id} to ${targetSocketId}`);
    io.to(targetSocketId).emit('ice-candidate', {
      candidate,
      senderSocketId: socket.id,
    });
  });

  // Note: Text messaging and control states are handled DIRECTLY via WebRTC RTCDataChannel P2P!

  // 5. Disconnection cleanup
  socket.on('disconnecting', () => {
    const userInfo = users.get(socket.id);
    if (userInfo) {
      const { roomId, username } = userInfo;
      console.log(`[Signaling Server] ${username} (${socket.id}) leaving room ${roomId}`);
      socket.to(roomId).emit('user-left', {
        socketId: socket.id,
        username,
      });
      users.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Signaling Server] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` WebRTC Express Signaling Server running on port ${PORT}`);
  console.log(` Health check available at: http://localhost:${PORT}/health`);
  console.log(` Note: P2P Data & Chat is handled via WebRTC RTCDataChannel`);
  console.log(`====================================================`);
});
