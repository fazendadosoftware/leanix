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
} from '@fazendadosoftware/lxr-core'

interface LeanIXPlugin extends Plugin {
  devServerUrl: string | null
  launchUrl: string | null
}

interface LeanIXPluginOptions {
  packageJsonPath?: string
}

const leanixPlugin = (pluginOptions?: LeanIXPluginOptions): LeanIXPlugin => {
  let logger: Logger
  let accessToken: AccessToken | null = null
  let claims: JwtClaims | null = null
  let isProduction: boolean = false
  let credentials: LeanIXCredentials = { host: '', apitoken: '' }

  return {
    name: 'vite-plugin-lxr',
    enforce: 'post',
    devServerUrl: null,
    launchUrl: null,
    async config (config, env) {
      try {
        credentials = await readLxrJson()
      } catch (error) {
        logger?.error('💥 Invalid lxr.json file, required params are "host" and "apitoken".')
        process.exit(1)
      }
      // server exposes host and runs in TLS + HTTPS2 mode
      // required for serving the custom report files in LeanIX
      config.base = ''
      config.server = { ...config.server ?? {}, https: true, host: true }
      if (credentials.proxyURL !== undefined) config.server.proxy = { '*': credentials.proxyURL }
    },
    async configResolved (resolvedConfig: ResolvedConfig) {
      isProduction = resolvedConfig.isProduction
      logger = resolvedConfig.logger
      if (resolvedConfig.command === 'serve' || resolvedConfig.isProduction) {
        try {
          accessToken = await getAccessToken(credentials)
          claims = getAccessTokenClaims(accessToken)
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          if (claims !== null) logger?.info(`🔥 Your workspace is ${claims.principal.permission.workspaceName}`)
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          logger?.error(err === 401 ? '💥 Invalid LeanIX API token' : `${err}`)
          process.exit(1)
        }
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
        })
      }
    },
    async writeBundle (options, outputBundle) {
      let metadata: CustomReportMetadata | undefined
      try {
        metadata = await readMetadataJson(pluginOptions?.packageJsonPath)
      } catch (err: any) {
        const errors: ValidationError[] | undefined = err.errors
        if (err?.code === 'ENOENT') {
          const path: string = err.path
          logger?.error(`💥 Could not find metadata file at "${path}"`)
          logger?.warn('🙋 Have you initialized this project?"')
        } else if (Array.isArray(errors)) {
          // logger?.error(`💥 Invalid metadata file "${metadataFilePath}"`)
          errors.forEach(error => {
            const { schema, path, message } = error
            const file = (schema === '/PackageJsonLXR' || path[0] === 'leanixReport')
              ? 'package.json'
              : 'lxreport.json'
            const errPath = path.length > 0 ? ` property "${path.join('.')}" ` : ' '
            logger?.error(`🥺 ${file}:${errPath}${message}`)
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
      if (bundle !== undefined && accessToken?.accessToken !== undefined && isProduction) {
        try {
          const result = await uploadBundle(bundle, accessToken.accessToken, credentials.proxyURL)
          if (result.status === 'ERROR') {
            logger?.error('💥 Error while uploading project to workpace, check your "package.json" file...')
            logger?.error(JSON.stringify(result, null, 2))
            process.exit(1)
          }
          const { id, version } = metadata
          if (claims !== null) logger?.info(`🥳 Report "${id}" with version "${version}" was uploaded to workspace "${claims.principal.permission.workspaceName}"!`)
        } catch (err: any) {
          logger?.error('💥 Error while uploading project to workpace...')
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          logger?.error(`💣 ${err}`)
          process.exit(1)
        }
      } else if (!isProduction) {
        logger?.warn('⚠️ Not in "production" mode, report will not be uploaded to the LeanIX workspace.')
      }
    }
  }
}

export default leanixPlugin
