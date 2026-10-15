module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  // @rn-primitives y nativewind publican código sin compilar, así que hay que transformarlos
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@rn-primitives/.*|nativewind|react-native-css-interop)',
  ],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text-summary'],
};
