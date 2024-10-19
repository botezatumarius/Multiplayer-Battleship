const express = require('express');
const axios = require('axios');
const Redis = require('redis');
const WebSocket = require('ws');

const app = express();
const port = 3000;

// Object to cache service addresses
const serviceAddressesCache = {};

// Redis client for caching service addresses
const redisClient = Redis.createClient({
  url: 'redis://localhost:6379'
});

// Middleware
app.use(express.json());

// WebSocket server setup
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');

  ws.on('message', async (message) => {
    const parsedMessage = JSON.parse(message);
    const { action, data, authHeader } = parsedMessage;

    try {
      const response = await handleBattleshipRequest(action, data, authHeader);
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('Error handling WebSocket message:', error.message);
      ws.send(JSON.stringify({ error: 'Error processing request', details: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Handle HTTP server upgrade to WebSocket
app.server = app.listen(port, () => {
  console.log(`API Gateway running on port ${port}`);
});

app.server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Battleship API Gateway!');
});

// API Gateway status check
app.get('/status', (req, res) => {
  res.sendStatus(200);
});

// REST Endpoint: Get Profile Service status
app.get('/profile/status', async (req, res) => {
  try {
    const serviceAddress = await getServiceAddress('profile');
    const response = await axios.get(`${serviceAddress}/status`, { timeout: 5000 });
    res.json({ status: response.data });
  } catch (error) {
    console.error('Error checking Profile Service status:', error.message);
    res.status(500).json({ error: 'Error checking Profile Service status' });
  }
});

// REST Endpoint: Handle Profile Service requests
app.post('/auth/:action', (req, res) => {
  const action = req.params.action;
  const data = req.body;
  const authHeader = req.headers.authorization;

  handleProfileRequest(action, data, authHeader)
    .then(response => res.json(response))
    .catch(error => res.status(500).json({ error: error.message }));
});

// Function to handle the Battleship request forwarding
const handleBattleshipRequest = async (action, data, authHeader) => {
  try {
    // Check if action requires authorization
    const requiresAuth = requiresAuthorization('battleship', action);
    if (requiresAuth && !authHeader) {
      throw new Error('Authorization header is required');
    }

    const serviceAddress = await getServiceAddress('battleship');

    let response;
    if (action === 'status') {
      // Handle status request as a GET request
      response = await axios.get(`${serviceAddress}/status`, {
        headers: requiresAuth ? { 'Authorization': authHeader } : {},
        timeout: 5000
      });
    } else {
      // Handle other actions as POST requests
      response = await axios.post(`${serviceAddress}/game/${action}`, data, {
        headers: requiresAuth ? { 'Authorization': authHeader } : {},
        timeout: 5000
      });
    }

    return response.data || response;
  } catch (error) {
    console.error('Error forwarding Battleship request:', error.message);
    throw new Error('Error processing Battleship request');
  }
};


// Function to handle all Profile service requests
const handleProfileRequest = async (action, data, authHeader) => {
  try {
    const requiresAuth = requiresAuthorization('profile', action);
    if (requiresAuth && !authHeader) {
      throw new Error('Authorization header is required');
    }

    const serviceAddress = await getServiceAddress('profile');
    let response;

    switch (action) {
      case 'register':
        response = await axios.post(`${serviceAddress}/auth/register`, data, {
          timeout: 5000
        });
        break;

      case 'login':
        response = await axios.post(`${serviceAddress}/auth/login`, data, {
          timeout: 5000
        });
        break;

      case 'profile':
        response = await axios.get(`${serviceAddress}/auth/profile`, {
          headers: requiresAuth ? { 'Authorization': authHeader } : {},
          timeout: 5000
        });
        break;

      case 'update-stats':
        response = await axios.post(`${serviceAddress}/update-stats`, data, {
          headers: { 'Authorization': authHeader },
          timeout: 5000
        });
        break;

      default:
        throw new Error('Unsupported action for Profile service');
    }

    return response.data || response;
  } catch (error) {
    console.error('Error forwarding Profile request:', error.message);
    throw new Error('Error processing Profile request');
  }
};

// Function to discover and cache the service address
const getServiceAddress = async (serviceName) => {
  if (serviceAddressesCache[serviceName]) return serviceAddressesCache[serviceName];
  const response = await axios.get(`http://localhost:4000/lookup/${serviceName}`);
  const address = response.data.serviceAddress;
  serviceAddressesCache[serviceName] = address;
  return address;
};

// Authorization logic for actions requiring authentication
const requiresAuthorization = (service, action) => {
  const nonProtectedActions = {
    battleship: ['status'],
    profile: ['register', 'login', 'status'],
    gateway: ['status'],
    discovery: ['status']
  };
  return !nonProtectedActions[service]?.includes(action);
};

// Redis client connection handling
redisClient.on('connect', () => {});

redisClient.on('error', (err) => {
  console.log('Redis Client Error:', err);
});

// Explicitly connect the Redis client
redisClient.connect().then(() => {
  console.log('Redis client connected successfully');
}).catch((err) => {
  console.error('Failed to connect Redis client:', err);
});

