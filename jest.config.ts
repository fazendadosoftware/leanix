import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  verbose: true,
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'babel-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json'
      }
    ]
  },
  projects: [
    {
      displayName: '@lxr/core',
      testPathIgnorePatterns: ['<rootDir>/node_modules/'],
      testMatch: ['<rootDir>/packages/core/src/**/*.spec.ts'],
      // TODO: // line 12 => https://stackoverflow.com/questions/69383514/node-fetch-3-0-0-and-jest-gives-syntaxerror-cannot-use-import-statement-outside
      transformIgnorePatterns: []
    },
    {
      displayName: 'vite-plugin-lxr',
      testPathIgnorePatterns: ['<rootDir>/node_modules/'],
      testMatch: ['<rootDir>/packages/vite-plugin-lxr/src/**/*.spec.ts']
    }
  ]
}
export default config
