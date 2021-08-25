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
      typescript({ declarationDir: 'dist/types', include: ['lib/**/*'] }),
      json(),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      terser({ module: true, warnings: true }),
      summary()
    ],
    output: [
      { dir: 'dist/', format: 'cjs', sourcemap: true, exports: 'auto' }
    ]
  },
  {
    input: 'lib/index.ts',
    plugins: [
      typescript({ outDir: 'dist/esm', composite: false, declaration: false, include: ['lib/**/*'] }),
      json(),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      terser({ module: true, warnings: true }),
      summary()
    ],
    output: [
      { dir: 'dist/esm', format: 'esm', sourcemap: true, exports: 'auto' }
    ]
  }
]
