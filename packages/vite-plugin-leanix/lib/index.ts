import { Plugin, Logger, ResolvedConfig } from 'vite'
import { AddressInfo } from 'net'
import { resolveHostname } from './helpers'
import { readLxrJson, readMetadataJson, getAccessToken, getLaunchUrl, createBundle, CustomReportMetadata, AccessToken, LeanIXCredentials, ValidationError } from '@fazendadosoftware/leanix-core'
import { openBrowser } from './openBrowser'

interface LeanIXPlugin extends Plugin {
  accessToken: AccessToken | null
  devServerUrl: string | null
  launchUrl: string | null
}

interface LeanIXPluginOptions {
  metadataFilePath?: string
}

const leanixPlugin = (options?: LeanIXPluginOptions): LeanIXPlugin => {
  let logger: Logger
  let open: string | boolean = false
  const metadataFilePath = options?.metadataFilePath ?? `${process.cwd()}/lxreport.json`

  return {
    name: 'vite-plugin-leanix',
    enforce: 'post',
    accessToken: null,
    devServerUrl: null,
    launchUrl: null,
    configResolved (resolvedConfig: ResolvedConfig) { logger = resolvedConfig.logger },
    config (config, env) {
      // server exposes host and runs in TLS + HTTPS2 mode
      // we disable the open flag as the plugin will handle it
      open = config.server?.open ?? false
      config.server = { ...config.server ?? {}, https: true, host: true, open: false }
    },
    configureServer ({ config: { server: { host, https } }, httpServer }) {
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
          const { port } = httpServer.address() as AddressInfo
          const { name: hostname } = resolveHostname(host)
          const protocol = https === true ? 'https' : 'http'
          this.devServerUrl = `${protocol}://${hostname}:${port}`
          try {
            this.accessToken = await getAccessToken(credentials)
            this.launchUrl = getLaunchUrl(this.devServerUrl, this.accessToken.accessToken)
            logger?.info(`🛎️ Your development workspace is available here: ${this.launchUrl}`)
          } catch (err) {
            logger?.error(err === 401 ? '💥 Invalid LeanIX API token' : err)
            process.exit(1)
          }
          if (open !== false) openBrowser(this.launchUrl, open, logger)
        })
      }
    },
    async writeBundle (options, bundle) {
      let metadata: CustomReportMetadata | undefined
      try {
        metadata = await readMetadataJson(metadataFilePath)
      } catch (err) {
        const errors: ValidationError[] | undefined = err.errors
        if (err.code === 'ENOENT') {
          const path: string = err.path
          logger?.error(`💥 Could not find metadata file at "${path}"`)
          logger?.warn('🙋 Have you initialized this project?"')
        } else if (Array.isArray(errors)) {
          logger?.error(`💥 Invalid metadata file "${metadataFilePath}"`)
          errors.forEach(error => {
            const message: string = error.message
            logger?.error(`🥺 "lxrreport.json" ${message}`)
          })
        }
        process.exit(1)
      }
      if (metadata !== undefined && options?.dir !== undefined) {
        await createBundle(metadata, options?.dir)
        logger?.info('🚀 Created project bundle')
      } else {
        logger?.error('💥 Could not create project bundle')
        process.exit(1)
      }
    }
  }
}

export default leanixPlugin
