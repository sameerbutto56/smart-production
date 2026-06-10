const app = require('./app');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

const isServerless = process.env.VERCEL === '1';

if (!isServerless) {
  const http = require('http');
  const socketIo = require('socket.io');
  const server = http.createServer(app);
  const frontendUrl = process.env.FRONTEND_URL || "*";

  const io = socketIo(server, {
    cors: {
      origin: frontendUrl,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: frontendUrl !== "*"
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('join-room', (room) => {
      socket.join(room);
      console.log(`User joined room: ${room}`);
    });
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  app.set('io', io);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log('Server is running on http://0.0.0.0:' + PORT);
  });
}

module.exports = app;
