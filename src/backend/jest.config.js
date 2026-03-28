module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 12,
      functions: 15,
      lines: 15,
      statements: 15,
    },
  },
  verbose: true,
  testTimeout: 10000,
  moduleNameMapper: {
    '^../../utils/prisma$': '<rootDir>/src/__mocks__/prisma.ts',
    '^../utils/prisma$': '<rootDir>/src/__mocks__/prisma.ts',
    '^../../../utils/prisma$': '<rootDir>/src/__mocks__/prisma.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
