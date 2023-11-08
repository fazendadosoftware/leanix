import { type Plugin, type Logger, type ResolvedConfig } from 'vite'
import { type AddressInfo } from 'net'
import { join } from 'path'
import { promises as fsp } from 'node:fs'
import { resolveHostname } from './helpers'
import {
  readLxrJson,
  readMetadataJson,
  getAccessToken,
  getAccessTokenClaims,
  getLaunchUrl,
  createBundle,
  uploadBundle,
  type CustomReportMetadata,
  type AccessToken,
  type LeanIXCredentials,
  type ValidationError,
  type CustomReportProjectBundle,
  type JwtClaims
} from 'lxr-core'

interface LeanIXPlugin extends Plugin {
  devServerUrl: string | null
  launchUrl: string | null
}

interface LeanIXPluginOptions {
  packageJsonPath?: string
}

// https://vitejs.dev/guide/migration.html#automatic-https-certificate-generation
// https://github.com/vitejs/vite-plugin-basic-ssl
export async function getCertificate (cacheDir: string): Promise<any> {
  const cachePath = join(cacheDir, '_cert.pem')

  try {
    const [stat, content] = await Promise.all([
      fsp.stat(cachePath),
      fsp.readFile(cachePath, 'utf8')
    ])

    if (Date.now() - stat.ctime.valueOf() > 30 * 24 * 60 * 60 * 1000) {
      throw new Error('cache is outdated.')
    }

    return content
  } catch {
    const content = (await import('./certificate')).createCertificate()
    fsp
      .mkdir(cacheDir, { recursive: true })
      .then(async () => { await fsp.writeFile(cachePath, content) })
      .catch(() => {})
    return content
  }
}

const leanixPlugin = (pluginOptions?: LeanIXPluginOptions): LeanIXPlugin => {
  let logger: Logger
  let accessToken: AccessToken | null = null
  let claims: JwtClaims | null = null
  let shouldUpload: boolean = false
  let loadWorkspaceCredentials: boolean = false
  let credentials: LeanIXCredentials = { host: '', apitoken: '' }
  let viteDevServerUrl: string
  let launchUrl: string

  const defaultCacheDir = 'node_modules/.vite'

  return {
    name: 'vite-plugin-lxr',
    enforce: 'post',
    devServerUrl: null,
    launchUrl: null,
    async config (config, env) {
      shouldUpload = env.mode === 'upload'
      loadWorkspaceCredentials = env.command === 'serve' || shouldUpload
      if (loadWorkspaceCredentials) {
        const certificate = await getCertificate((config.cacheDir ?? defaultCacheDir) + '/basic-ssl')
        const https = (): any => ({ cert: certificate, key: certificate })

        // server exposes host and runs in TLS + HTTPS2 mode
        // required for serving the custom report files in LeanIX
        config.base = ''
        config.server = { ...config.server ?? {}, https: https(), host: true }
        config.preview = { ...config.preview ?? {}, https: https() }
        if (credentials.proxyURL !== undefined) config.server.proxy = { '*': credentials.proxyURL }
        try {
          credentials = await readLxrJson()
        } catch (error) {
          logger = logger ?? console
          const code = (error as { code: string })?.code ?? null
          if (code === 'ENOENT') {
            logger.error('💥 Error: "lxr.json" file not found in your project root')
          } else logger?.error(error as string)

          process.exit(1)
        }
      }
    },
    async configResolved (resolvedConfig: ResolvedConfig) {
      logger = resolvedConfig.logger
      if (loadWorkspaceCredentials) {
        try {
          if (typeof credentials.proxyURL === 'string') {
            logger?.info(`👀 vite-plugin is using the following proxy: ${credentials.proxyURL}`)
          }
          accessToken = await getAccessToken(credentials)
          claims = getAccessTokenClaims(accessToken)
          if (claims !== null) logger?.info(`🔥 Your workspace is ${claims.principal.permission.workspaceName}`)
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          logger?.error(err === 401 ? '💥 Invalid LeanIX API token' : `${err}`)
          process.exit(1)
        }
      }
    },
    configureServer ({ config: { server: { host, https = null } }, httpServer }) {
      if (httpServer !== null) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        httpServer.on('listening', async () => {
          const { port } = httpServer.address() as AddressInfo
          const { name: hostname } = resolveHostname(host)
          const protocol = https !== null ? 'https' : 'http'
          viteDevServerUrl = `${protocol}://${hostname}:${port}`
          if (accessToken !== null) {
            launchUrl = getLaunchUrl(viteDevServerUrl, accessToken.accessToken)
            setTimeout(() => {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              logger?.info(`🚀 Your development server is available here => ${launchUrl}`)
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
      if (bundle !== undefined && accessToken?.accessToken !== undefined && shouldUpload) {
        try {
          const { accessToken: bearerToken } = accessToken
          const { proxyURL, store } = credentials
          const { id, version } = metadata
          if (claims !== null) {
            if (typeof store?.assetId === 'string') logger.info(`😅 Deploying asset id ${store.assetId} to ${store.host ?? 'store.leanix.net'}...`)
            else logger.info(`😅 Uploading report ${id} with version "${version}" to workspace "${claims.principal.permission.workspaceName}"...`)
          }

          const result = await uploadBundle({ bundle, bearerToken, proxyURL, store })
          if (result.status === 'ERROR') {
            logger?.error('💥 Error while uploading project to workpace, check your "package.json" file...')
            logger?.error(JSON.stringify(result, null, 2))
            process.exit(1)
          }
          if (typeof store?.assetId === 'string') logger.info(`😅 Asset id ${store.assetId} has been deployed to ${store.host ?? 'store.leanix.net'}...`)
          else if (claims !== null) logger?.info(`🥳 Report "${id}" with version "${version}" was uploaded to workspace "${claims.principal.permission.workspaceName}"!`)
        } catch (err: any) {
          logger?.error('💥 Error while uploading project to workpace...')
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          logger?.error(`💣 ${err}`)
          process.exit(1)
        }
      }
    }
  }
}

export default leanixPlugin
