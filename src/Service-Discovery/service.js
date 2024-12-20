const express = require('express');
const Redis = require('redis');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios'); 
const promClient = require('prom-client');
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const app = express();
app.use(express.json());

// Metrics for service discovery
const registeredServicesGauge = new promClient.Gauge({
  name: 'registered_services_total',
  help: 'Total number of registered services in the service discovery system',
});

const successfulHealthChecksCounter = new promClient.Counter({
  name: 'successful_health_checks_total',
  help: 'Total number of successful health checks performed on services',
});

const failedHealthChecksCounter = new promClient.Counter({
  name: 'failed_health_checks_total',
  help: 'Total number of failed health checks performed on services',
});

// Register the metrics
register.registerMetric(registeredServicesGauge);
register.registerMetric(successfulHealthChecksCounter);
register.registerMetric(failedHealthChecksCounter);





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

  // Start the periodic health check of services
  startServiceHealthChecks();
});

// Function to ping all registered services
const startServiceHealthChecks = () => {
  // Periodically ping services every 10 seconds
  setInterval(async () => {
    try {
      console.log("\nHEALTH CHECK:")
      // Get all service names (keys) from Redis
      const serviceNames = await redisClient.keys('*');

      // For each service, get its addresses and ping them
      for (const serviceName of serviceNames) {
        const serviceAddresses = await redisClient.lRange(serviceName, 0, -1);
        
        // Ping each address in the list
        for (const serviceAddress of serviceAddresses) {
          let modifiedServiceAddress = serviceAddress; 
          try {
          const portMatch = serviceAddress.match(/:(\d+)$/);
          if (portMatch) {
            const port = portMatch[1]; 
            const lastDigit = port.charAt(port.length - 1); 
            const modValue = Math.abs(lastDigit - 3) || 1; 
            const [protocol,addressName,portNum] = serviceAddress.split(':')
            if (serviceName == "profile") {
              modifiedServiceAddress = `${protocol}:${addressName}-${modValue}:${portNum}`;
            } else modifiedServiceAddress = `${protocol}:${addressName}-${lastDigit}:${portNum}`;
          }
            const response = await axios.get(`${modifiedServiceAddress}/status`);
            console.log(`Service ${serviceName} at ${modifiedServiceAddress} is alive. Status: ${response.status}`);
            // Increment the successful health check counter
            successfulHealthChecksCounter.inc();
          } catch (error) {
            console.error(`Service ${serviceName} at ${modifiedServiceAddress} is down. Error: ${error.message}`);
            // Increment the failed health check counter
            failedHealthChecksCounter.inc();
          }
        }
      }
    } catch (error) {
      console.error('Error retrieving services from Redis:', error);
    }
  }, 20000); // 20-second interval
};

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});


// Lookup a service
app.get('/lookup/:serviceName', async (req, res) => {
  const { serviceName } = req.params;

  try {
    // Check if the serviceName exists in Redis
    const keyExists = await redisClient.exists(serviceName);
    
    if (!keyExists) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Retrieve all service addresses from Redis
    const serviceAddresses = await redisClient.lRange(serviceName, 0, -1);
    
    // Respond with the retrieved addresses
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
    
    // Update the registered services metric
    registeredServicesGauge.inc();
    
    res.status(200).json({ message: `${serviceName} registered successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register service', details: err.message });
  }
});

// Start the HTTP server
const httpPort = 4000; // HTTP port
const startHttpServer = () => {
  app.listen(httpPort, () => {
    console.log(`Service Discovery HTTP server running on port ${httpPort}`);
  });
};

startHttpServer();

// Export the app and start the HTTP server
module.exports = app;