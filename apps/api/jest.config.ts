import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^argon2$': '<rootDir>/src/test/mocks/argon2.mock.ts'
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.(t|j)s']
};

export default config;
