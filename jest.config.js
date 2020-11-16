module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testPathIgnorePatterns: ['node_modules', 'test/setup.ts'],
  testMatch: ['**/test/*.ts'],
  moduleFileExtensions: ['ts', 'js'],
}
