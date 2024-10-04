const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const Redis = require('redis');

const app = express();
const port = 3000;

// Object to cache service addresses
const serviceAddressesCache = {};

// Concurrent request limits and queues
const maxConcurrentRequests = 5;
const requestQueues = {
  battleship: [],
  profile: []
};
const activeRequests = {
  battleship: 0,
  profile: 0
};

const redisClient = Redis.createClient({
  url: 'redis://localhost:6379'
});

// Middleware
app.use(express.json());

// Function to process queued requests
const processQueue = (service) => {
  if (requestQueues[service].length > 0 && activeRequests[service] < maxConcurrentRequests) {
    const { ws, service, action, data, authHeader, resolve } = requestQueues[service].shift();
    handleRequest(ws, service, action, data, authHeader).then(resolve);
  }
};

// Handle Redis connection events
redisClient.on('connect', () => {});

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

      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
        return ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }

      const { service, action, data, authHeader } = parsedMessage;

       // Handle Service Discovery status check
       if (service === 'discovery' && action === 'status') {
        const response = await axios.get('http://localhost:4000/status');
        ws.send(JSON.stringify(response.data));
        return
     }

     if (service === 'gateway' && action === 'status') {
      response = { status: 200, message: 'API Gateway is running' };
      return
    } 

      if (service in activeRequests) {
        if (activeRequests[service] < maxConcurrentRequests) {
          activeRequests[service]++;
          handleRequest(ws, service, action, data, authHeader).finally(() => {
            activeRequests[service]--;
            processQueue(service);
          });
        } else {
          requestQueues[service].push({
            ws,
            service,
            action,
            data,
            authHeader,
            resolve: () => {
              activeRequests[service]++;
              handleRequest(ws, service, action, data, authHeader).finally(() => {
                activeRequests[service]--;
                processQueue(service);
              });
            }
          });
        }
      } else {
        ws.send(JSON.stringify({ error: 'Unknown service' }));
      }
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

  // Function to handle the request
  const handleRequest = async (ws, service, action, data, authHeader) => {
    try {
      const requiresAuth = requiresAuthorization(service, action);
      if (requiresAuth && !authHeader) {
        return ws.send(JSON.stringify({ error: 'Authorization header is required' }));
      }

      const serviceAddress = await getServiceAddress(service);

      let response;
      if (service === 'battleship' && action === 'status') {
        try {
            response = await axios.get(`${serviceAddress}/${action}`, {
                headers: requiresAuth ? { 'Authorization': authHeader } : {},
                timeout: 5000
            });
            return ws.send(JSON.stringify({ status: 200, message: 'Battleship service is healthy' }));
        } catch (error) {
            console.error('Error fetching battleship status:', error.message);
            return ws.send(JSON.stringify({ status: 503, error: 'Battleship service is down' }));
        }
    } else if (service === 'profile' && action === 'status') {
        try {
            response = await axios.get(`${serviceAddress}/${action}`, {
                headers: requiresAuth ? { 'Authorization': authHeader } : {},
                timeout: 5000
            });
            return ws.send(JSON.stringify({ status: 200, message: 'Profile service is healthy' }));
        } catch (error) {
            console.error('Error fetching profile status:', error.message);
            return ws.send(JSON.stringify({ status: 503, error: 'Profile service is down' }));
        }
    }
    
    
    else if (service === 'battleship') {
        response = await axios.post(`${serviceAddress}/game/${action}`, data, {
          headers: requiresAuth ? { 'Authorization': authHeader } : {},
          timeout: 5000
        });
      } else if (service === 'profile') {
        if (action === 'profile') {
          response = await axios.get(`${serviceAddress}/auth/${action}`, {
            headers: requiresAuth ? { 'Authorization': authHeader } : {},
            timeout: 5000
          });
        } else {
          response = await axios.post(`${serviceAddress}/auth/${action}`, data, {
            headers: requiresAuth ? { 'Authorization': authHeader } : {},
            timeout: 5000
          });
        }
      }

      ws.send(JSON.stringify(response.data || response));
    } catch (error) {
      console.error('Error forwarding request:', error.message);
      if (error.response && error.response.data) {
        ws.send(JSON.stringify(error.response.data));
      } else {
        ws.send(JSON.stringify({ error: 'Error processing request', details: error.message }));
      }
    }
  };

  const getServiceAddress = async (serviceName) => {
    if (serviceAddressesCache[serviceName]) return serviceAddressesCache[serviceName];
    const response = await axios.get(`http://localhost:4000/lookup/${serviceName}`);
    const address = response.data.serviceAddress;
    serviceAddressesCache[serviceName] = address;
    return address;
  };

  const requiresAuthorization = (service, action) => {
    const nonProtectedActions = {
      battleship: ['status'],
      profile: ['register', 'login', 'status'],
      gateway: ['status'],
      discovery: ['status']
    };
    return !nonProtectedActions[service]?.includes(action);
  };

  app.listen(port, () => {
    console.log(`API Gateway running on port ${port}`);
  });
}).catch((err) => {
  console.error('Failed to connect Redis client:', err);
});