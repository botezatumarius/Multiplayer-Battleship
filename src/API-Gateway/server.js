const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios');
const app = express();
const port = 3000;

let requestCount = 0; // Track number of requests per second
const threshold = 1; // Threshold for critical load
const resetInterval = 1000; // Reset request counter every second
const retryLimit = 3; // Circuit breaker threshold for failures
const taskTimeoutLimit = 5000; // Timeout for task requests
let concurrentTasks = 0; // Number of concurrent tasks
const concurrentTaskLimit = 10; // Maximum number of concurrent tasks allowed

// Store retry counts for requests
const retryCounts = {};
const circuitBreakerTimeouts = {}; // Store circuit breaker open time

// Load gRPC service definition
const packageDefinition = protoLoader.loadSync('service.proto', {});
const proto = grpc.loadPackageDefinition(packageDefinition).servicediscovery;

// Initialize gRPC client
const serviceDiscoveryClient = new proto.ServiceDiscovery('service-discovery:50051', grpc.credentials.createInsecure());

// Object to store round-robin indexes for services
const roundRobinIndexes = {};

// Middleware
app.use(express.json());

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

// Middleware to enforce concurrency limit
app.use(async (req, res, next) => {
  if (concurrentTasks >= concurrentTaskLimit) {
    return res.status(429).json({ error: 'Too many requests - concurrency limit reached' });
  }
  requestCount++;
  concurrentTasks++; // Increment task count
  try {
    next(); // Proceed with request
  } finally {
    concurrentTasks--; // Decrement task count when request completes
  }
});

// API Gateway status check
app.get('/status', (req, res) => {
  res.sendStatus(200);
});

// Circuit breaker implementation with 15-second reset 
const circuitBreaker = async (serviceAddress, reqConfig) => {
  const circuitBreakerTimeout = 60000; 

  if (!retryCounts[serviceAddress]) {
    retryCounts[serviceAddress] = 0;
  }

  // Check if the circuit breaker is open
  if (circuitBreakerTimeouts[serviceAddress]) {
    const elapsedTime = Date.now() - circuitBreakerTimeouts[serviceAddress];
    if (elapsedTime < circuitBreakerTimeout) {
      console.warn(`Circuit breaker is open for service: ${serviceAddress}. Skipping request.`);
      return null; 
    } else {
      // Reset circuit breaker after 60 seconds
      retryCounts[serviceAddress] = 0;
      delete circuitBreakerTimeouts[serviceAddress]; 
    }
  }

  // Retry logic for service request
  while (retryCounts[serviceAddress] < retryLimit) {
    try {
      const response = await axios(reqConfig);
      retryCounts[serviceAddress] = 0; 
      return response;
    } catch (error) {
      console.error(`Error on attempt ${retryCounts[serviceAddress] + 1} for service ${serviceAddress}:`, error.message);
      retryCounts[serviceAddress]++;

      if (retryCounts[serviceAddress] >= retryLimit) {
        console.error(`Circuit breaker triggered for service: ${serviceAddress}. Service is considered failed.`);
        circuitBreakerTimeouts[serviceAddress] = Date.now(); // Open the circuit breaker

        //Set a timeout to log the reset message after 60 seconds
        setTimeout(() => {
          retryCounts[serviceAddress] = 0; 
          console.log(`Circuit breaker for service: ${serviceAddress} has been reset after 60 seconds.`);
        }, circuitBreakerTimeout);

        return null; // Return null if the service fails 3 times
      }
    }
  }

  return null;
};


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
    const response = await circuitBreaker(serviceAddress, {
      url: `${serviceAddress}/status`,
      method: 'get',
      timeout: taskTimeoutLimit
    });
    if (!response) {
      res.status(503).json({ error: 'Profile Service is temporarily unavailable' });
    } else {
      res.json({ status: response.data });
    }
  } catch (error) {
    console.error('Error checking Profile Service status:', error.message);
    res.status(500).json({ error: 'Error checking Profile Service status' });
  }
});

// gRPC Endpoint: Get Battleship Service status
app.get('/battleship/status', async (req, res) => {
  try {
    const serviceAddress = await getServiceAddress('battleship');
    const response = await circuitBreaker(serviceAddress, {
      url: `${serviceAddress}/status`,
      method: 'get',
      timeout: taskTimeoutLimit
    });
    if (!response) {
      res.status(503).json({ error: 'Battleship Service is temporarily unavailable' });
    } else {
      res.json({ status: response.data });
    }
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
    let reqConfig;

    switch (action) {
      case 'register':
        reqConfig = { url: `${serviceAddress}/auth/register`, method: 'post', data, timeout: taskTimeoutLimit };
        break;
      case 'login':
        reqConfig = { url: `${serviceAddress}/auth/login`, method: 'post', data, timeout: taskTimeoutLimit };
        break;
      case 'profile':
        reqConfig = {
          url: `${serviceAddress}/auth/profile`,
          method: 'get',
          headers: { Authorization: authHeader },
          timeout: taskTimeoutLimit,
        };
        break;
      case 'update-stats':
        reqConfig = {
          url: `${serviceAddress}/update-stats`,
          method: 'post',
          data,
          headers: { Authorization: authHeader },
          timeout: taskTimeoutLimit,
        };
        break;
      default:
        throw new Error('Unsupported action for Profile service');
    }

    const response = await circuitBreaker(serviceAddress, reqConfig);
    if (!response) {
      res.status(503).json({ error: 'Profile Service is temporarily unavailable' });
    } else {
      res.json(response.data);
    }
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
