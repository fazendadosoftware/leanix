require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  extends: [
    'standard-with-typescript'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    project: 'tsconfig.eslint.json'
  },
  rules: {
    semi: [2, 'never']
  },
  env: {
    node: true,
    es6: true
  }
}
