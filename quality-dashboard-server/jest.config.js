module.exports = {
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    // cookie@2 (through light-my-request, used by fastify.inject in route
    // tests) is published ESM-only. Specs run as CommonJS, so this subtree is
    // transpiled; every other node_modules file stays raw.
    'node_modules/(?:cookie)/.+\\.(ts|tsx|js)$': ['@swc/jest', {
      jsc: {
        target: 'es2020'
      }
    }],
    '^.+\\.(ts|tsx)$': ['@swc/jest', {
      jsc: {
        target: 'es2020'
      }
    }]
  },
  transformIgnorePatterns: [],
  coverageProvider: 'v8',
  testMatch: ['**/src/**/*.spec.(ts|js)'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^uuid$': '<rootDir>/__mocks__/uuid.cjs'
  },
  collectCoverageFrom: ['src/**/*.ts', '!**/node_modules/**', '!**/vendor/**']
};
