const swaggerAutogen = require('swagger-autogen')();

const outputFile = './swagger-output.json';
const endpointsFiles = [
  './src/routes/auth.routes.ts',
  './src/routes/server.routes.ts',
  './src/routes/gpu.routes.ts',
  './src/routes/task.routes.ts',
  './src/routes/monitoring.routes.ts',
];

const doc = {
  info: {
    title: 'Laboratory Server Management System API',
    description: 'API for managing laboratory servers, GPU resources, and task scheduling',
    version: '1.0.0',
  },
  host: 'localhost:8080',
  basePath: '/api',
  schemes: ['http', 'https'],
  consumes: ['application/json'],
  produces: ['application/json'],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization',
    },
    {
      name: 'Servers',
      description: 'Server resource management',
    },
    {
      name: 'GPU',
      description: 'GPU allocation and management',
    },
    {
      name: 'Tasks',
      description: 'Task scheduling and management',
    },
    {
      name: 'Monitoring',
      description: 'System monitoring and metrics',
    },
  ],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
      description: 'JWT token in format: Bearer {token}',
    },
  },
  definitions: {
    User: {
      id: 'uuid',
      username: 'johndoe',
      email: 'john@example.com',
      role: 'USER',
      createdAt: '2024-01-01T00:00:00Z',
    },
    Server: {
      id: 'uuid',
      name: 'GPU-Server-01',
      hostname: 'gpu01.lab.local',
      ipAddress: '192.168.1.100',
      status: 'ONLINE',
      cpuCores: 32,
      totalMemory: 128,
      gpuCount: 4,
    },
    Gpu: {
      id: 'uuid',
      serverId: 'uuid',
      deviceId: 0,
      model: 'NVIDIA A100',
      memory: 40,
      status: 'AVAILABLE',
    },
    Task: {
      id: 'uuid',
      name: 'Training Job',
      description: 'Model training task',
      userId: 'uuid',
      status: 'PENDING',
      priority: 5,
    },
  },
};

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger documentation generated successfully!');
});
