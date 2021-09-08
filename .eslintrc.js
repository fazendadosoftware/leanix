// @ts-check
const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  root: true,
  extends: [
    'standard-with-typescript'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    project: ['./tsconfig.json']
  },
  ignorePatterns: ['**/dist', '.eslintrc.js'],
  rules: {
  },
  globals: {
    NodeJS: true
  },
  env: {
    node: true,
    es2021: true,
    jest: true
  }
})
