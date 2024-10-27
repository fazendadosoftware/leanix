import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  verbose: true,
  testEnvironment: 'node',
  projects: [
    {
      testPathIgnorePatterns: ['<rootDir>/node_modules/'],
      displayName: '@lxr/core',
      testMatch: ['<rootDir>/packages/core/src/**/*.spec.ts'],
      // TODO: // line 12 => https://stackoverflow.com/questions/69383514/node-fetch-3-0-0-and-jest-gives-syntaxerror-cannot-use-import-statement-outside
      transformIgnorePatterns: []
    }
  ],
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'babel-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json'
      }
    ]
  },
  coverageReporters: ['text', 'cobertura'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        suiteName: 'leanix-torg',
        outputDirectory: 'test_results',
        outputName: 'junit.xml'
      }
    ]
  ]
}
export default config
