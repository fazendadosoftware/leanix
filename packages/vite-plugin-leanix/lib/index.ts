import { Plugin, Logger, ResolvedConfig } from 'vite'
import { AddressInfo } from 'net'
import { resolveHostname } from './helpers'
import { readLxrJson, getAccessToken, getLaunchUrl, CustomReportMetadata, AccessToken, LeanIXCredentials } from '@fazendadosoftware/leanix-core'

// https://github.com/nshen/vite-plugin-cesium/blob/main/src/index.ts

const getDummyReportMetadata = (): CustomReportMetadata => ({
  id: 'net.fazendadosoftware.testReport',
  name: 'custom-report-name',
  title: 'Fazenda do Software Test Report',
  version: '0.1.0',
  description: 'Custom Report Description',
  author: 'John Doe',
  documentationLink: 'https://www.google.com',
  defaultConfig: {}
})

const reportMetadata = getDummyReportMetadata()

interface LeanIXPluginOptions {
  launchUrlCallback?: (launchUrl: string) => void
  errorCallback?: (error: any) => void
}

interface LeanIXPlugin extends Plugin {
  accessToken: AccessToken | null
  devServerUrl: string | null
  launchUrl: string | null
}

const leanixPlugin = (options: LeanIXPluginOptions = {}): LeanIXPlugin => {
  const { launchUrlCallback, errorCallback } = options
  let logger: Logger | null = null

  return {
    name: 'vite-plugin-leanix',
    enforce: 'post',
    accessToken: null,
    devServerUrl: null,
    launchUrl: null,
    configResolved (resolvedConfig: ResolvedConfig) {
      logger = resolvedConfig.logger
    },
    config (config, env) {
      // set development server to https
      if (config.server !== undefined) config.server.https = true
    },
    configureServer (server) {
      const { httpServer = null } = server
      if (httpServer !== null) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        httpServer.on('listening', async () => {
          let credentials: LeanIXCredentials = { host: '', apitoken: '' }
          try {
            credentials = await readLxrJson()
          } catch (error) {
            logger?.error('💥 Invalid lxr.json file, required params are "host" and "apitoken".')
            process.exit(1)
          }
          const options = server.config.server
          const { port } = httpServer.address() as AddressInfo
          const { name: hostname } = resolveHostname(options.host)
          const protocol = options.https === true ? 'https' : 'http'
          this.devServerUrl = `${protocol}://${hostname}:${port}`
          try {
            this.accessToken = await getAccessToken(credentials)
            this.launchUrl = getLaunchUrl(this.devServerUrl, this.accessToken.accessToken)
            logger?.info(`🚀 Your development workspace is available here: ${this.launchUrl}`)
            if (typeof launchUrlCallback === 'function') launchUrlCallback(this.launchUrl)
          } catch (err) {
            logger?.error(err === 401 ? '💥 Invalid LeanIX API token' : err)
            if (typeof errorCallback === 'function') errorCallback(err)
            else process.exit(1)
          }
        })
      }
    },
    writeBundle (options, bundle) {
      console.log(bundle)
    }
  }
}

export default leanixPlugin
