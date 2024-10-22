const express = require('express');
const axios = require('axios');
const Redis = require('redis');

const app = express();
const port = 3000;

// Object to store round-robin indexes for services
const roundRobinIndexes = {};

// Middleware
app.use(express.json());

// Handle HTTP server upgrade to WebSocket
app.server = app.listen(port, () => {
  console.log(`API Gateway running on port ${port}`);
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Battleship API Gateway!');
});

// API Gateway status check
app.get('/status', (req, res) => {
  res.sendStatus(200);
});

// Round-Robin Load Balancing for Profile Service
const getServiceAddress = async (serviceName) => {
  const response = await axios.get(`http://service-discovery:4000/lookup/${serviceName}`);
  const serviceAddresses = response.data.serviceAddresses;
  console.log(serviceAddresses);

  if (serviceAddresses.length === 0) {
    throw new Error(`No instances found for service: ${serviceName}`);
  }

  // Initialize or reset the round-robin index for this service if necessary
  if (!roundRobinIndexes[serviceName] || roundRobinIndexes[serviceName] >= serviceAddresses.length) {
    roundRobinIndexes[serviceName] = 0;
  }

  const currentIndex = roundRobinIndexes[serviceName];
  const serviceAddress = serviceAddresses[currentIndex];

  // Extract the port from the serviceAddress
  const portMatch = serviceAddress.match(/:(\d+)$/);

  let modifiedServiceAddress = serviceAddress; // Default to original address if no port found

  if (portMatch) {
    const port = portMatch[1]; // Get the port number
    const lastDigit = port.charAt(port.length - 1); // Get the last digit of the port
    const modValue = Math.abs(lastDigit - 3) || 1; // Calculate last digit mod 3
    const [protocol,addressName,portNum] = serviceAddress.split(':')
    const modifiedServiceName = `${protocol}:${addressName}-${modValue}:${portNum}`;
    modifiedServiceAddress = `${modifiedServiceName}`;
  }

  // Update round-robin index for the next request
  roundRobinIndexes[serviceName] = currentIndex + 1;

  // Log the service address being used
  console.log(`Request done on service address: ${modifiedServiceAddress}`);

  return modifiedServiceAddress; // Return the modified service address
};



// REST Endpoint: Get Profile Service status
app.get('/profile/status', async (req, res) => {
  try {
    const serviceAddress = await getServiceAddress('profile');
    console.log(serviceAddress)
    const response = await axios.get(`${serviceAddress}/status`, { timeout: 5000 });
    
    res.json({ status: response.data });
  } catch (error) {
    console.error('Error checking Profile Service status:', error.message);
    res.status(500).json({ error: 'Error checking Profile Service status' });
  }
});

// REST Endpoint: Handle Profile Service requests (Round-Robin Load Balancing)
app.post('/auth/:action', async (req, res) => {
  const action = req.params.action;
  const data = req.body;
  const authHeader = req.headers.authorization;

  try {
    const serviceAddress = await getServiceAddress('profile');
    let response;

    switch (action) {
      case 'register':
        response = await axios.post(`${serviceAddress}/auth/register`, data, { timeout: 5000 });
        break;
      case 'login':
        response = await axios.post(`${serviceAddress}/auth/login`, data, { timeout: 5000 });
        break;
      case 'profile':
        response = await axios.get(`${serviceAddress}/auth/profile`, {
          headers: { 'Authorization': authHeader },
          timeout: 5000,
        });
        break;
      case 'update-stats':
        response = await axios.post(`${serviceAddress}/update-stats`, data, {
          headers: { 'Authorization': authHeader },
          timeout: 5000,
        });
        break;
      default:
        throw new Error('Unsupported action for Profile service');
    }

    res.json(response.data);
  } catch (error) {
    console.error('Error forwarding Profile request:', error.message);
    res.status(500).json({ error: 'Error processing Profile request' });
  }
});

// WebSocket Endpoint: Get Battleship Service instance port (Round-Robin)
app.get('/battleship/instance', async (req, res) => {
  try {
    const serviceAddress = await getServiceAddress('battleship');
    const instancePort = serviceAddress.split(':').pop();
    res.json({ instancePort });
  } catch (error) {
    console.error('Error retrieving Battleship instance:', error.message);
    res.status(500).json({ error: 'Error retrieving Battleship instance' });
  }
});

// Status check for Service Discovery
app.get('/service-discovery/status', async (req, res) => {
  try {
    const response = await axios.get(`http://service-discovery:4000/status`);
    res.json({ discoveryStatus: response.data });
  } catch (error) {
    console.error('Error checking Service Discovery status:', error.message);
    res.status(500).json({ error: 'Error checking Service Discovery status' });
  }
});
