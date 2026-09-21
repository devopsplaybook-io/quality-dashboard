module.exports = {
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': ['@swc/jest', {
      jsc: {
        target: 'es2020'
      }
    }]
  },
  coverageProvider: 'v8',
  testMatch: ['**/src/**/*.spec.(ts|js)'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^uuid$': '<rootDir>/__mocks__/uuid.cjs'
  },
  collectCoverageFrom: ['src/**/*.ts', '!**/node_modules/**', '!**/vendor/**']
};
