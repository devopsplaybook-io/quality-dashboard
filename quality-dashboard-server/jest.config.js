module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.spec.json'
    }
  },
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.spec.json'
    }]
  },
  testMatch: ['**/src/**/*.spec.(ts|js)'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^uuid$': '<rootDir>/__mocks__/uuid.cjs'
  },
  collectCoverageFrom: ['src/**/*.ts', '!**/node_modules/**', '!**/vendor/**']
};
