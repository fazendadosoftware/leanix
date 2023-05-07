import { build, type BuildOptions, type Format } from 'esbuild'

const getOptions = (format: Format, fileExtension: string): BuildOptions => ({
  entryPoints: ['lib/index.ts'],
  outfile: `dist/index.${fileExtension}`,
  bundle: true,
  format,
  sourcemap: true,
  minify: true,
  loader: { '.ts': 'ts' },
  platform: 'node'
})

void (async () => {
  const formats: Partial<Record<Format, string>> = {
    esm: 'mjs',
    cjs: 'cjs'
  }

  for (const [format, fileExtension] of Object.entries(formats)) {
    const options = getOptions(format as Format, fileExtension)
    await build(options)
  }
  console.log('⚡ Done')
})()
