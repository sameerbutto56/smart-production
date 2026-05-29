const http = require('http');
const socketIo = require('socket.io');
const { app, prisma } = require('./app');

const server = http.createServer(app);
const frontendUrl = process.env.FRONTEND_URL || "*";

const io = socketIo(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: frontendUrl !== "*"
  }
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
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

const connectDB = async (retries = 5) => {
  while (retries) {
    try {
      await prisma.$connect();
      console.log('Connected to the database successfully');
      break;
    } catch (err) {
      console.error('Database connection failed (Retries left: ' + (retries - 1) + '):', err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

connectDB();

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server is running on http://0.0.0.0:' + PORT);
});

module.exports = { app, io, prisma };
