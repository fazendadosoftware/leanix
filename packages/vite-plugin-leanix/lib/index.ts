import { Plugin, Logger, ResolvedConfig } from 'vite'
import { AddressInfo } from 'net'
import { resolveHostname } from './helpers'
import {
  readLxrJson,
  readMetadataJson,
  getAccessToken,
  getAccessTokenClaims,
  getLaunchUrl,
  createBundle,
  uploadBundle,
  CustomReportMetadata,
  AccessToken,
  LeanIXCredentials,
  ValidationError,
  CustomReportProjectBundle,
  JwtClaims
} from '@fazendadosoftware/leanix-core'
import { openBrowser } from './openBrowser'

interface LeanIXPlugin extends Plugin {
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
  let accessToken: AccessToken | null = null
  let claims: JwtClaims | null = null

  return {
    name: 'vite-plugin-leanix',
    enforce: 'post',
    devServerUrl: null,
    launchUrl: null,
    async config (config, env) {
      // server exposes host and runs in TLS + HTTPS2 mode
      // we disable the open flag as the plugin will handle it
      open = config.server?.open ?? false
      // required for serving the custom report files in LeanIX
      config.base = ''
      config.server = { ...config.server ?? {}, https: true, host: true, open: false }
    },
    async configResolved (resolvedConfig: ResolvedConfig) {
      logger = resolvedConfig.logger
      let credentials: LeanIXCredentials = { host: '', apitoken: '' }
      try {
        credentials = await readLxrJson()
      } catch (error) {
        logger?.error('💥 Invalid lxr.json file, required params are "host" and "apitoken".')
        process.exit(1)
      }
      try {
        accessToken = await getAccessToken(credentials)
        claims = getAccessTokenClaims(accessToken)
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        if (claims !== null) logger?.info(`🔥 Your workspace is ${claims.principal.permission.workspaceName}`)
      } catch (err) {
        logger?.error(err === 401 ? '💥 Invalid LeanIX API token' : err)
        process.exit(1)
      }
    },
    configureServer ({ config: { server: { host, https } }, httpServer }) {
      if (httpServer !== null) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        httpServer.on('listening', async () => {
          const { port } = httpServer.address() as AddressInfo
          const { name: hostname } = resolveHostname(host)
          const protocol = https === true ? 'https' : 'http'
          this.devServerUrl = `${protocol}://${hostname}:${port}`
          if (accessToken !== null) {
            this.launchUrl = getLaunchUrl(this.devServerUrl, accessToken.accessToken)
            setTimeout(() => {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              logger?.info(`🚀 Your development server is available here => ${this.launchUrl}`)
            }, 1)
          } else throw Error('💥 Could not get launch url, no accessToken...')
          if (open !== false) openBrowser(this.launchUrl, open, logger)
        })
      }
    },
    async writeBundle (options, outputBundle) {
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
      let bundle: CustomReportProjectBundle | undefined
      if (metadata !== undefined && options?.dir !== undefined) {
        bundle = await createBundle(metadata, options?.dir)
      } else {
        logger?.error('💥 Error while create project bundle file.')
        process.exit(1)
      }
      if (bundle !== undefined && accessToken?.accessToken !== undefined) {
        try {
          const result = await uploadBundle(bundle, accessToken.accessToken)
          if (result.status === 'ERROR') {
            logger?.error('💥 Error while uploading project to workpace, check your "lxreport.json" file:')
            logger?.error(JSON.stringify(result, null, 2))
            process.exit(1)
          }
          const { id, version } = metadata
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          if (claims !== null) logger?.info(`🥳 Report "${id}" with version "${version}" was uploaded to workspace "${claims.principal.permission.workspaceName}"!`)
        } catch (err) {
          logger?.error(`💥 ${JSON.stringify(err)}`)
          process.exit(1)
        }
      }
    }
  }
}

export default leanixPlugin
