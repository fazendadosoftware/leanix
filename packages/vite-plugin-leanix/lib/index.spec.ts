import test from 'ava'
import { createServer, build, InlineConfig } from 'vite'
import leanixPlugin from './index'

const getInlineConfig = (port: number = 6666): InlineConfig => ({
  root: __dirname,
  server: { port, host: true },
  plugins: []
})

test.only('plugin gets the launch url in development', async t => {
  t.timeout(10000, 'timeout occurred!')
  const inlineConfig = getInlineConfig()

  const plugin = leanixPlugin()

  inlineConfig.plugins?.push(plugin)

  const server = await createServer(inlineConfig)
  await server.listen()
  const interval = setInterval(() => t.log('Waiting for launch url...'), 1000)
  while (plugin.launchUrl === null) await new Promise<void>(resolve => setTimeout(() => resolve(), 100))
  clearInterval(interval)

  const url = new URL(plugin.launchUrl)
  const devServerUrl = url.searchParams.get('url')

  t.is(url.protocol, 'https:', 'launch url is https')
  t.is(devServerUrl, plugin.devServerUrl, 'launch url has the correct devServerUrl')
  await server.close()
})

test('plugin creates custom report bundle with build command', async t => {
  t.timeout(10000, 'timeout occurred!')
  const inlineConfig = getInlineConfig()

  const plugin = leanixPlugin()

  inlineConfig.plugins?.push(plugin)

  const output = await build(inlineConfig)
  console.log(output)
})
