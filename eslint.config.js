const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettier,
  { rules: { complexity: ['error', 10] } },
  { ignores: ['dist/*', 'coverage/*', '.expo/*'] },
];
