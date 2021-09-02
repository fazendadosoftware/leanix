import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import summary from 'rollup-plugin-summary'
import copy from 'rollup-plugin-copy'
import pkg from './package.json'

const moduleName = pkg.name.replace(/^@.*\//, '')
const inputFileName = 'lib/index.ts'
const author = pkg.author

const banner = `
  /**
   * @license
   * author: ${author}
   * ${moduleName}.js v${pkg.version}
   * Released under the ${pkg.license} license.
   */
`
/**
 * @type {import('rollup').RollupOptions}
 */
export default [
  {
    input: inputFileName,
    output: [
      {
        dir: 'dist/',
        format: 'cjs',
        sourcemap: false,
        banner,
        exports: 'auto'
      }
    ],
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {})
    ],
    plugins: [
      copy({ targets: [{ src: 'templates', dest: 'dist/' }] }),
      typescript({ outputToFilesystem: false }),
      json({ compact: true }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      terser({ module: true, warnings: true }),
      summary()
    ]
  }
]
