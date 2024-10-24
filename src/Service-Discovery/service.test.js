const request = require('supertest');
const Redis = require('redis');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Mock Redis Client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),
  lRange: jest.fn().mockResolvedValue([]),
  rPush: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  type: jest.fn().mockResolvedValue('list'),
  on: jest.fn(),
  disconnect: jest.fn().mockResolvedValue(undefined), 
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

const app = require('./service'); 

const packageDefinition = protoLoader.loadSync('service.proto', {});
const proto = grpc.loadPackageDefinition(packageDefinition).servicediscovery;
const grpcClient = new proto.ServiceDiscovery(`localhost:50051`, grpc.credentials.createInsecure());

describe('Service Discovery API', () => {
  beforeAll(async () => {
    await mockRedisClient.connect();
  });

  afterAll(async () => {
    await mockRedisClient.disconnect();
  });

  afterEach(() => {
    jest.clearAllMocks(); 
  });

  it('should register a new service', async () => {
    const response = await request(app)
      .post('/register')
      .send({ serviceName: 'testService', serviceAddress: 'http://localhost:3000' });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('testService registered successfully');
  });

  it('should look up a registered service', async () => {
    mockRedisClient.lRange.mockResolvedValue(['http://localhost:3000']);
    mockRedisClient.exists.mockResolvedValue(1); 

    await request(app)
      .post('/register')
      .send({ serviceName: 'testService', serviceAddress: 'http://localhost:3000' });

    const response = await request(app)
      .get('/lookup/testService');

    expect(response.status).toBe(200);
    expect(response.body.serviceAddresses).toContain('http://localhost:3000');
  });

  it('should return 404 for a non-existent service', async () => {
    mockRedisClient.exists.mockResolvedValue(0); 
    const response = await request(app).get('/lookup/nonExistentService');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Service not found');
  });

  it('should return 400 for invalid registration', async () => {
    const response = await request(app)
      .post('/register')
      .send({}); 

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Service name and address required');
  });


  it('should return health status from gRPC', (done) => {
    grpcClient.Status({}, (error, response) => {
      expect(error).toBeNull();
      expect(response).toHaveProperty('message', 'Service Discovery is healthy');
      expect(response).toHaveProperty('redis', 'PONG');
      done();
    });
  });
});
