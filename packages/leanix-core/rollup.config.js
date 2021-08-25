import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import summary from 'rollup-plugin-summary'

/**
 * @type {import('rollup').RollupOptions}
 */
export default [
  {
    input: 'lib/index.ts',
    plugins: [
      typescript({ outDir: 'dist/cjs', tsconfig: './tsconfig.json', include: ['lib/**/*'], outputToFilesystem: true }),
      json(),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      terser({ module: true, warnings: true }),
      summary()
    ],
    output: [
      { dir: 'dist/cjs', format: 'cjs', sourcemap: true }
    ]
  },
  {
    input: 'lib/index.ts',
    plugins: [
      typescript({ outDir: 'dist/mjs', tsconfig: './tsconfig.json', include: ['lib/**/*'], outputToFilesystem: true }),
      json(),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      terser({ module: true, warnings: true }),
      summary()
    ],
    output: [
      { dir: 'dist/mjs', format: 'esm', sourcemap: true }
    ]
  }
]
