const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios');

const app = express();
const port = 3000;

let requestCount = 0; // Track number of requests per second
const threshold = 1; // Set threshold for critical load
const resetInterval = 1000; // Reset request counter every second

// Load gRPC service definition
const packageDefinition = protoLoader.loadSync('service.proto', {});
const proto = grpc.loadPackageDefinition(packageDefinition).servicediscovery;

// Initialize gRPC client
const serviceDiscoveryClient = new proto.ServiceDiscovery('service-discovery:50051', grpc.credentials.createInsecure());

// Object to store round-robin indexes for services
const roundRobinIndexes = {};

// Middleware
app.use(express.json());

// Handle HTTP server upgrade to WebSocket
app.server = app.listen(port, () => {
  console.log(`API Gateway running on port ${port}`);
});

// Function to reset the request counter every second
setInterval(() => {
  if (requestCount > threshold) {
    console.warn(`High load alert: ${requestCount} requests per second exceeded the threshold of ${threshold}`);
  }
  requestCount = 0; // Reset the counter
}, resetInterval);

// Middleware to track incoming requests
app.use((req, res, next) => {
  requestCount++; // Increment request count for each incoming request
  next();
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

  if (!roundRobinIndexes[serviceName] || roundRobinIndexes[serviceName] >= serviceAddresses.length) {
    roundRobinIndexes[serviceName] = 0;
  }

  const currentIndex = roundRobinIndexes[serviceName];
  const serviceAddress = serviceAddresses[currentIndex];

  const portMatch = serviceAddress.match(/:(\d+)$/);

  let modifiedServiceAddress = serviceAddress; // Default to original address if no port found

  if (portMatch) {
    const port = portMatch[1]; 
    const lastDigit = port.charAt(port.length - 1); 
    const modValue = Math.abs(lastDigit - 3) || 1; 
    const [protocol, addressName, portNum] = serviceAddress.split(':');
    if (serviceName == 'profile') {
      modifiedServiceAddress = `${protocol}:${addressName}-${modValue}:${portNum}`;
    } else modifiedServiceAddress = `${protocol}:${addressName}-${lastDigit}:${portNum}`;
  }

  roundRobinIndexes[serviceName] = currentIndex + 1;

  console.log(`Request done on service address: ${modifiedServiceAddress}`);

  return modifiedServiceAddress; 
};

// gRPC Endpoint: Get Profile Service status
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

// gRPC Endpoint: Get Battleship Service status
app.get('/battleship/status', async (req, res) => {
  try {
    const serviceAddress = await getServiceAddress('battleship');
    const response = await axios.get(`${serviceAddress}/status`, { timeout: 5000 });
    res.json({ status: response.data });
  } catch (error) {
    console.error('Error checking Battleship Service status:', error.message);
    res.status(500).json({ error: 'Error checking Battleship Service status' });
  }
});

// gRPC Endpoint: Handle Profile Service requests (Round-Robin Load Balancing)
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
          headers: { Authorization: authHeader },
          timeout: 5000,
        });
        break;
      case 'update-stats':
        response = await axios.post(`${serviceAddress}/update-stats`, data, {
          headers: { Authorization: authHeader },
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
    serviceDiscoveryClient.Status({}, (error, response) => {
      if (error) {
        throw error;
      }
      res.json({ discoveryStatus: response });
    });
  } catch (error) {
    console.error('Error checking Service Discovery status:', error.message);
    res.status(500).json({ error: 'Error checking Service Discovery status' });
  }
});
