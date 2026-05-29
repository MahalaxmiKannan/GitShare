import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import session from 'express-session';
import passport from 'passport';
import connectDB from './db.js';
import { CLIENT_URL, PORT, SESSION_SECRET } from './config.js';
import './config/passport.js'; // Import configured Passport
import authRoutes from './routes/auth.js';
import commentsRouter from './routes/comments.js';
import githubRouter from './routes/github.js';

const app = express();

const allowedOrigins = [
  CLIENT_URL,
  'https://gitshareio.netlify.app',
  'http://localhost:5173'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
};

// Connect to Database
connectDB();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true if using https in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Basic API routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the GitShare backend API' });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Authentication Routes
app.use('/auth', authRoutes);

// Comments Router
app.use('/api/comments', commentsRouter);

// GitHub Bridge Router
app.use('/github', githubRouter);


// HTTP & WebSocket Servers Setup
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Memory presence tracking: roomId -> [{ socketId, username, avatarUrl }]
const activeRooms = {};
const roomCreators = {};

const removeSocketFromRoom = (socket, roomId) => {
  const collaborators = activeRooms[roomId];
  if (!collaborators) {
    return;
  }

  const nextCollaborators = collaborators.filter(user => user.socketId !== socket.id);
  if (nextCollaborators.length === collaborators.length) {
    return;
  }

  socket.leave(roomId);

  if (nextCollaborators.length === 0) {
    delete activeRooms[roomId];
    delete roomCreators[roomId];
    return;
  }

  activeRooms[roomId] = nextCollaborators;
  io.to(roomId).emit('room-users', {
    users: nextCollaborators,
    creator: roomCreators[roomId]
  });
  socket.to(roomId).emit('user-left', { socketId: socket.id });
};

// WebSocket Event Handling
io.on('connection', (socket) => {
  // Join a collaborative room
  socket.on('join-room', ({ roomId, username, avatarUrl }) => {
    socket.join(roomId);

    if (!activeRooms[roomId]) {
      activeRooms[roomId] = [];
    }

    // Set creator of the room if not already defined
    if (!roomCreators[roomId]) {
      roomCreators[roomId] = username;
    }

    // Avoid duplicate users for the same socket connection
    if (!activeRooms[roomId].find(u => u.socketId === socket.id)) {
      activeRooms[roomId].push({ socketId: socket.id, username, avatarUrl });
    }

    // Notify all clients in the room of the updated user list and creator
    io.to(roomId).emit('room-users', {
      users: activeRooms[roomId],
      creator: roomCreators[roomId]
    });
    socket.to(roomId).emit('user-joined', { socketId: socket.id, username });
  });

  // Handle live code changes
  socket.on('code-change', (data) => {
    if (data && data.roomId) {
      socket.to(data.roomId).emit('code-change', data);
    }
  });

  // Fallback alias for compatibility
  socket.on('code-update', (data) => {
    if (data && data.roomId) {
      socket.to(data.roomId).emit('code-change', data);
      socket.to(data.roomId).emit('code-update', data);
    }
  });

  // Handle cursor and highlight changes
  socket.on('cursor-move', ({ roomId, range, username, fileName }) => {
    socket.to(roomId).emit('cursor-move', { socketId: socket.id, range, username, fileName });
  });

  // Handle live delete file
  socket.on('delete-file', (data) => {
    if (data && data.roomId) {
      socket.to(data.roomId).emit('delete-file', data);
    }
  });

  // Handle real-time review comments broadcast
  socket.on('new-comment', (data) => {
    if (data && data.roomId && data.comment) {
      socket.to(data.roomId).emit('new-comment', data.comment);
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    if (roomId) {
      removeSocketFromRoom(socket, roomId);
    }
  });

  // Handle peer disconnection
  socket.on('disconnecting', () => {
    for (const room of [...socket.rooms]) {
      if (room !== socket.id) {
        removeSocketFromRoom(socket, room);
      }
    }
  });

  socket.on('disconnect', () => {});
});

// Start the Server
httpServer.listen(PORT, () => {
  console.info(`GitShare server running on port ${PORT}`);
});
