const express = require('express');
const Redis = require('redis');

const app = express();
app.use(express.json());

// Initialize Redis client
const redisClient = Redis.createClient({
    url: 'redis://redis:6379'
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
    // Check if the key exists
    const keyExists = await redisClient.exists(serviceName);
    
    // If the key exists, check its type
    if (keyExists) {
      const type = await redisClient.type(serviceName);
      if (type === 'string') {
        // Delete the string key to allow for a list
        await redisClient.del(serviceName);
      } else if (type !== 'list') {
        // If the type is not a list, handle the situation
        return res.status(400).json({ error: `Key '${serviceName}' already exists and is of type '${type}'` });
      }
    }

    // Initialize the key as a list and add the service address
    await redisClient.rPush(serviceName, serviceAddress);
    res.status(200).json({ message: `${serviceName} registered successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register service', details: err.message });
  }
});

// Lookup a service
app.get('/lookup/:serviceName', async (req, res) => {
  const { serviceName } = req.params;

  try {
    // Retrieve all service addresses from Redis
    const serviceAddresses = await redisClient.lRange(serviceName, 0, -1);
    if (serviceAddresses.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.status(200).json({ serviceAddresses });
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
