import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

export default {
  input: 'lib/index.ts',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json', include: ['lib/**/*'], outputToFilesystem: true }),
    json(),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    terser()
  ]
}
