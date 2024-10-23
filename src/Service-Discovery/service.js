const express = require('express');
const Redis = require('redis');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const app = express();
app.use(express.json());

// Load gRPC service definition
const packageDefinition = protoLoader.loadSync('service.proto', {});
const proto = grpc.loadPackageDefinition(packageDefinition).servicediscovery;

// Initialize Redis client
const redisClient = Redis.createClient({
    url: 'redis://redis:6379'
});

redisClient.on('connect', () => {
  console.log('Connected to Redis for service discovery');
});

redisClient.on('error', (err) => {
  console.log('Redis Client Error', err);
});

redisClient.connect().then(() => {
  console.log('Redis client connected successfully');

  // Start the gRPC server
  const grpcServer = new grpc.Server();

  grpcServer.addService(proto.ServiceDiscovery.service, {
    Status: async (call, callback) => {
      try {
        const pingResponse = await redisClient.ping();
        callback(null, { message: 'Service Discovery is healthy', redis: pingResponse });
      } catch (err) {
        callback({
          code: grpc.status.INTERNAL,
          details: 'Failed to communicate with Redis'
        });
      }
    }
  });

  const port = 50051; // gRPC port
  grpcServer.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`gRPC Service Discovery running on port ${port}`);
  });
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

// HTTP Endpoint to register a new service
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



// Start the HTTP server
const httpPort = 4000; // HTTP port
app.listen(httpPort, () => {
  console.log(`Service Discovery HTTP server running on port ${httpPort}`);
});
