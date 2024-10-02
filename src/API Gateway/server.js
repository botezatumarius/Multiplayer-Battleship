const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const Redis = require('redis');

const app = express();
const port = 3000;
const redisClient = Redis.createClient();

app.use(express.json());

// Redis connection
redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// REST API for routing
app.use('/auth', require('./routes/auth'));
app.use('/game', require('./routes/game'));

//ws://localhost:8080
// WebSocket Server
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');
  ws.on('message', (message) => {
    console.log('Received:', message);
    // Forward WebSocket messages to microservices here
  });
});

// Define the root route
app.get('/', (req, res) => {
    res.send('Welcome to the Battleship API Gateway!');
});

// Status Check Endpoint
app.get('/status', (req, res) => {
  console.log('200 OK'); 
  res.sendStatus(200); 
});

// Function to ping microservices with timeout
const pingMicroservices = async () => {
  const TIMEOUT = 5000; // 5 seconds timeout

  try {
    const response = await axios.get('http://localhost:8081/status', { timeout: TIMEOUT });
    console.log('Battleship Service is healthy! Response:', response.status);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('Battleship Service request timed out.');
    } else {
      console.error('Battleship Service is down:', error.message);
    }
  }

  try {
    const response = await axios.get('http://localhost:8082/status', { timeout: TIMEOUT });
    console.log('Profile Service is healthy! Response:', response.status);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('Profile Service request timed out.');
    } else {
      console.error('Profile Service is down:', error.message);
    }
  }
};

// Ping microservices every 10 seconds
setInterval(pingMicroservices, 10000);

// Start the server
app.listen(port, () => {
  console.log(`API Gateway running on port ${port}`);
});
