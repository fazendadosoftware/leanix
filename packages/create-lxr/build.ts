import { build, BuildOptions } from 'esbuild'

const options: BuildOptions = {
  entryPoints: ['index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  loader: {
    '.ts': 'ts'
  },
  platform: 'node'
}

void (async () => {
  await build(options)
  console.log('⚡ Done')
})()
