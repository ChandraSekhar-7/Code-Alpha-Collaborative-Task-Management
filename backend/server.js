const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with dynamic CORS
const io = new Server(server, {
  cors: {
    origin: "https://code-alpha-collaborative-task-management.onrender.com",
    methods: ["GET", "POST", "PUT"]
  }
});

connectDB();

app.use(cors());
app.use(express.json());

// Attach socket io instance to req context so routes can use it
app.use((req, res, next) => {
  req.io = io;
  next();
});

// HTTP Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));

// WebSocket Event System for Real-time Updates
io.on('connection', (socket) => {
  console.log(`User connected to signaling server: ${socket.id}`);
  
  socket.on('joinProject', (projectId) => {
    socket.join(projectId);
    console.log(`Socket client joined room: ${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Production Server running on port ${PORT}`));