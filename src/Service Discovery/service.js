const express = require('express');
const Redis = require('redis');

const app = express();
app.use(express.json());

// Initialize Redis client
const redisClient = Redis.createClient({
    url: 'redis://localhost:6379'
  });
  

// Handle Redis connection events
redisClient.on('connect', () => {
  console.log('Connected to Redis for service discovery');
});

redisClient.on('error', (err) => {
  console.log('Redis Client Error', err);
});

// Explicitly connect the Redis client
redisClient.connect().then(() => {
  console.log('Redis client connected successfully');

  // Start the server after Redis connects
  const port = 4000;
  app.listen(port, () => {
    console.log(`Service Discovery running on port ${port}`);
  });
});

// Register a new service
app.post('/register', async (req, res) => {
  const { serviceName, serviceAddress } = req.body;

  if (!serviceName || !serviceAddress) {
    return res.status(400).json({ error: 'Service name and address required' });
  }

  try {
    // Store the service address in Redis with the service name as the key
    await redisClient.set(serviceName, serviceAddress);
    res.status(200).json({ message: `${serviceName} registered successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register service', details: err.message });
  }
});

// Lookup a service
app.get('/lookup/:serviceName', async (req, res) => {
  const { serviceName } = req.params;

  try {
    // Retrieve the service address from Redis
    const serviceAddress = await redisClient.get(serviceName);
    if (!serviceAddress) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.status(200).json({ serviceAddress });
  } catch (err) {
    res.status(500).json({ error: 'Error looking up service', details: err.message });
  }
});

// Status check endpoint to verify if the service discovery is healthy
app.get('/status', async (req, res) => {
  try {
    // Ping Redis to ensure it's healthy
    const pingResponse = await redisClient.ping();
    res.status(200).json({ message: 'Service Discovery is healthy', redis: pingResponse });
  } catch (err) {
    res.status(500).json({ error: 'Failed to communicate with Redis', details: err.message });
  }
});
