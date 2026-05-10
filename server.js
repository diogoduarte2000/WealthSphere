const { createServer } = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const env = require('./src/config/env');
const { connectDatabase } = require('./src/config/db');

const httpServer = createServer(app);
const allowCredentials = env.clientOrigin !== '*' && !env.clientOrigin.includes?.('*');

const io = new Server(httpServer, {
  cors: {
    origin: env.clientOrigin,
    credentials: allowCredentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

app.set('io', io);

async function startServer() {
  const database = await connectDatabase(env.mongoUri);

  if (database.connected) {
    console.log('MongoDB connected');
  } else {
    console.error('MongoDB connection failed:', database.error.message);
  }

  httpServer.listen(env.port, () => {
    console.log(`WealthSphere backend running on port ${env.port}`);
  });
}

startServer();
