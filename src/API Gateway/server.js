const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const Redis = require('redis');

const app = express();
const port = 3000;

// Object to cache service addresses
const serviceAddressesCache = {};

const redisClient = Redis.createClient({
  url: 'redis://localhost:6380' // Not necessary atm
});

// Middleware
app.use(express.json());

// Handle Redis connection events
redisClient.on('connect', () => {
});

redisClient.on('error', (err) => {
  console.log('Redis Client Error:', err);
});

// Explicitly connect the Redis client
redisClient.connect().then(() => {
  console.log('Redis client connected successfully');

  // Start the WebSocket server after Redis connection
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');

    ws.on('message', async (message) => {
      console.log('Received:', message);

      // Parse incoming message
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
        return ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }

      console.log(`Parsed message:`, parsedMessage);

      const { service, action, data, authHeader } = parsedMessage;

      console.log(`Service: ${service}, Action: ${action}`);

      // Handle Service Discovery status check
      if (service === 'discovery' && action === 'status') {
        const response = await axios.get('http://localhost:4000/status');
        ws.send(JSON.stringify(response.data));
        return
     }

      try {
        // Check if authorization is required for the action
        const requiresAuth = requiresAuthorization(service, action);
        if (requiresAuth && !authHeader) {
          return ws.send(JSON.stringify({ error: 'Authorization header is required' }));
        }

        // Lookup service address using service discovery
        const serviceAddress = await getServiceAddress(service);
        console.log(`Service address for ${service}: ${serviceAddress}`);
        
        let response;
        
        // Handle requests based on the service and action
        if (service === 'gateway' && action === 'status') {
          // API Gateway status check
          response = { status: 200, message: 'API Gateway is running' };
        } else if (service === 'battleship' && action === 'status') {
          console.log("Sending request to battleship service");
          // GET request for battleship status
          response = await axios.get(`${serviceAddress}/${action}`, {
            headers: requiresAuth ? { 'Authorization': authHeader } : {},
            timeout: 5000 
          });
        } else if (service === 'profile' && action === 'status') {
          console.log("Sending request to profile service");
          // GET request for profile status
          response = await axios.get(`${serviceAddress}/${action}`, {
            headers: requiresAuth ? { 'Authorization': authHeader } : {},
            timeout: 5000 
          });
        } else if (service === 'battleship') {
          // Handle other battleship actions (assumed to be POST)
          response = await axios.post(`${serviceAddress}/game/${action}`, data, {
            headers: requiresAuth ? { 'Authorization': authHeader } : {},
            timeout: 5000 
          });
        } else if (service === 'profile') {
          // Handle profile actions
          if (action === 'profile') {
            response = await axios.get(`${serviceAddress}/auth/${action}`, {
              headers: requiresAuth ? { 'Authorization': authHeader } : {},
              timeout: 5000 
            });
          } else {
            // Default to POST for other profile actions
            response = await axios.post(`${serviceAddress}/auth/${action}`, data, {
              headers: requiresAuth ? { 'Authorization': authHeader } : {},
              timeout: 5000 
            });
          }
        } else {
          return ws.send(JSON.stringify({ error: 'Unknown service or action' }));
        }

        // Send the actual response from the service or an error
        ws.send(JSON.stringify(response.data || response));
      } catch (error) {
        console.error('Error forwarding request:', error.message);
        
        // Send the error message from the microservice (if available)
        if (error.response && error.response.data) {
          ws.send(JSON.stringify(error.response.data));
        } else {
          ws.send(JSON.stringify({ error: 'Error processing request', details: error.message }));
        }
      }
    });
  });

  // Root route
  app.get('/', (req, res) => {
    res.send('Welcome to the Battleship API Gateway!');
  });

  // API Gateway status check
  app.get('/status', (req, res) => {
    console.log('200 OK');
    res.sendStatus(200);
  });

  // Function to get service address from the service discovery service
  const getServiceAddress = async (serviceName) => {
    console.log(`Looking up service address for: ${serviceName}`); 

    // Check cache first
    if (serviceAddressesCache[serviceName]) {
      return serviceAddressesCache[serviceName];
    }

    // If not in cache, fetch from service discovery
    try {
      const response = await axios.get(`http://localhost:4000/lookup/${serviceName}`); 
      const address = response.data.serviceAddress;
      serviceAddressesCache[serviceName] = address;
      return address;
    } catch (error) {
      console.error(`Error looking up service ${serviceName}:`, error.message);
      throw new Error('Service not found');
    }
  };

  // Function to check service status
  const checkServiceStatus = async (url, serviceName) => {
    try {
      const response = await axios.get(url, { timeout: 5000 }); 
      return { status: 200, message: `${serviceName} Service is healthy!` };
    } catch (error) {
      return { status: 500, message: `${serviceName} Service is down: ${error.message}` };
    }
  };

  // Function to ping microservices every 10 seconds
  const pingMicroservices = async () => {
    try {
      // Check if there are any cached service addresses
      if (Object.keys(serviceAddressesCache).length === 0) {
        return;
      }

      // Iterate over each cached service address
      for (const [serviceName, serviceUrl] of Object.entries(serviceAddressesCache)) {
        const statusResponse = await checkServiceStatus(`${serviceUrl}/status`, serviceName);
        console.log(statusResponse.message);
      }
    } catch (error) {
      console.error('Error pinging microservices:', error.message);
    }
  };

  // Ping microservices every 10 seconds
  setInterval(pingMicroservices, 10000);

  // Check if the action requires authorization
  const requiresAuthorization = (service, action) => {
    const nonProtectedActions = {
      battleship: ['status'], // Actions that don't require auth in battleship service
      profile: ['register', 'login', 'status', 'profile'], // Actions that don't require auth in profile service
      gateway: ['status'], // Actions that don't require auth in gateway service,
      discovery: ['status']
    };

    return !nonProtectedActions[service]?.includes(action);
  };

  // Start the server
  app.listen(port, () => {
    console.log(`API Gateway running on port ${port}`);
  });
}).catch((err) => {
  console.error('Failed to connect Redis client:', err);
});
