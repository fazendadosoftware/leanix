module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: [
    'standard-with-typescript'
  ],
  ignorePatterns: ['**/dist'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'], // Your TypeScript files extension
      parserOptions: {
        project: ['./tsconfig.json', '.packages/vite-plugin-leanix/tsconfig.json'] // Specify it only for TypeScript files
      }
    }
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
  },
  globals: {
    NodeJS: true
  }
}
