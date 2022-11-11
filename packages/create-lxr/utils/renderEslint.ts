import * as fs from 'node:fs'
import * as path from 'node:path'

import type { Linter } from 'eslint'

import createESLintConfig from '@vue/create-eslint-config'

import { devDependencies as eslintDeps } from '../templates/vue/eslint/package.json' assert { type: 'json' }
import sortDependencies from './sortDependencies'
import deepMerge from './deepMerge'

export interface IRenderEslintParams {
  needsTypeScript?: boolean
  needsCypress?: boolean
  needsCypressCT?: boolean
  needsPrettier?: boolean
}

export default function renderEslint (
  rootDir: string,
  params?: IRenderEslintParams
): void {
  const additionalConfig: Linter.Config = {}
  const additionalDependencies: Record<string, any> = {}

  if ((params?.needsCypress) ?? false) {
    additionalConfig.overrides = [
      {
        files: ((params?.needsCypressCT) ?? false)
          ? [
              '**/__tests__/*.{cy,spec}.{js,ts,jsx,tsx}',
              'cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}'
            ]
          : ['cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}'],
        extends: ['plugin:cypress/recommended']
      }
    ]

    additionalDependencies['eslint-plugin-cypress'] = eslintDeps['eslint-plugin-cypress']
  }

  const { pkg, files } = createESLintConfig({
    vueVersion: '3.x',
    // we currently don't support other style guides
    styleGuide: 'default',
    hasTypeScript: params?.needsTypeScript ?? false,
    needsPrettier: params?.needsPrettier ?? false,

    additionalConfig,
    additionalDependencies
  })

  // update package.json
  const packageJsonPath = path.resolve(rootDir, 'package.json')
  const existingPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const updatedPkg = sortDependencies(
    deepMerge(deepMerge(existingPkg, pkg), {
      scripts: {
        // Note that we reuse .gitignore here to avoid duplicating the configuration
        lint: params?.needsTypeScript ?? false
          ? 'eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore'
          : 'eslint . --ext .vue,.js,.jsx,.cjs,.mjs --fix --ignore-path .gitignore'
      }
    })
  )
  fs.writeFileSync(packageJsonPath, JSON.stringify(updatedPkg, null, 2) + '\n', 'utf-8')

  // write to .eslintrc.cjs, .prettierrc.json, etc.
  for (const [fileName, content] of Object.entries(files)) {
    const fullPath = path.resolve(rootDir, fileName)
    fs.writeFileSync(fullPath, content as string, 'utf-8')
  }
}
