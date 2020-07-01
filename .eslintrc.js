module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2020: true,
  },
  plugins: ['prettier'],
  extends: ['plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 11,
  },
  rules: {
    'prettier/prettier': 'error',
    'linebreak-style': ['error', 'windows'],
  },
};
