import fetch, { type RequestInit } from 'node-fetch'
import { URL } from 'url'
import { HttpsProxyAgent } from 'https-proxy-agent'
import jwtDecode from 'jwt-decode'
import FormData from 'form-data'
import { c } from 'tar'
import { resolve } from 'path'
// import { readFile } from 'fs/promises'
import { existsSync, writeFileSync, readdirSync, createReadStream, type ReadStream, readFileSync } from 'fs'
import { validate, type ValidatorResult } from 'jsonschema'
import LeanIXCredentialsSchema from './schema/LeanIXCredentials.json'
import CustomReportMetadataSchema from './schema/CustomReportMetadata.json'
import PackageJsonLXRSchema from './schema/PackageJsonLXR.json'

export { validate, ValidationError, ValidatorResult } from 'jsonschema'

type LeanIXHost = string
type LeanIXApiToken = string
type BearerToken = string
type LeanIXWorkspaceId = string
type LeanIXWorkspaceName = string
type ReportId = string
type ReportName = string
type ReportTitle = string
type ReportVersion = string
type ReportDescription = string
type ReportAuthor = string
type ReportConfig = object
export type CustomReportProjectBundle = ReadStream

export interface LeanIXCredentials {
  host: LeanIXHost
  apitoken: LeanIXApiToken
  proxyURL?: string
  store?: {
    host?: string
    assetId: string
  }
}

export interface AccessToken {
  accessToken: BearerToken
  expired: boolean
  expiresIn: number
  scope: string
  tokenType: string
}

export interface JwtClaims {
  exp: number
  instanceUrl: string
  iss: string
  jti: string
  sub: string
  principal: { permission: { workspaceId: LeanIXWorkspaceId, workspaceName: LeanIXWorkspaceName } }
}

export interface CustomReportMetadata {
  id: ReportId
  reportId?: ReportId
  name: ReportName
  title: ReportTitle
  version: ReportVersion
  author: ReportAuthor
  description: ReportDescription
  defaultConfig: ReportConfig
}

export interface PackageJsonLXR {
  name: string
  version: string
  description: string
  author: string
  leanixReport: {
    id: string
    title: string
    defaultConfig: object
  }
}

const snakeToCamel = (s: string): string => s.replace(/([-_]\w)/g, g => g[1].toUpperCase())

// utility function for validating "package.json", "lxr.json" and "lxreport.json" files
export const validateDocument = async (document: unknown, name: 'lxr.json' | 'lxreport.json' | 'package.json'): Promise<ValidatorResult> => {
  let schema: unknown
  switch (name) {
    case 'package.json':
      schema = PackageJsonLXRSchema
      break
    case 'lxr.json':
      schema = LeanIXCredentialsSchema
      break
    case 'lxreport.json':
      schema = CustomReportMetadataSchema
      break
    default:
      schema = null
  }
  if (schema === null) throw Error(`unknown document name ${name}`)
  const result = validate(document, schema, { throwAll: false })
  if (!result.valid) {
    const errorMsg = `💥 ${name} - ${result.errors.map(({ message }) => message).join(', ')}`
    throw Error(errorMsg)
  }
  return result
}

export const readLxrJson = async (path?: string): Promise<LeanIXCredentials> => {
  if ((path ?? '').length === 0) path = `${process.cwd()}/lxr.json`
  const { host, apitoken, proxyURL = null, store = null } = JSON.parse(path !== undefined ? readFileSync(path).toString() : '{}')
  const credentials: LeanIXCredentials = { host, apitoken }
  if (proxyURL !== null) credentials.proxyURL = proxyURL
  if (store !== null) credentials.store = store
  await validateDocument(credentials, 'lxr.json')
  return credentials
}

export const readMetadataJson = async (path = `${process.cwd()}/package.json`): Promise<CustomReportMetadata> => {
  const fileContent = readFileSync(path).toString()
  const pkg: PackageJsonLXR = JSON.parse(fileContent)
  await validateDocument(pkg, 'package.json')
  const { name, version, author, description, leanixReport } = pkg
  const metadata: CustomReportMetadata = { name, version, author, description, ...leanixReport }
  await validateDocument(metadata, 'lxreport.json')
  return metadata
}

export const createProxyAgent = (proxyURL: string): HttpsProxyAgent<string> => new HttpsProxyAgent(new URL(proxyURL))

export const getAccessToken = async (credentials: LeanIXCredentials): Promise<AccessToken> => {
  const uri = `https://${credentials.host}/services/mtm/v1/oauth2/token?grant_type=client_credentials`
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from('apitoken:' + credentials.apitoken).toString('base64')}`
  }
  const options: RequestInit = { method: 'post', headers }
  if (credentials.proxyURL !== undefined) options.agent = createProxyAgent(credentials.proxyURL)
  const accessToken: AccessToken = await fetch(uri, options)
    .then(async res => {
      const content = await res[res.headers.get('content-type') === 'application/json' ? 'json' : 'text']()
      return res.ok ? content : await Promise.reject(res.status)
    })
    .then(accessToken => Object.entries(accessToken as AccessToken)
      .reduce((accumulator, [key, value]) => ({ ...accumulator, [snakeToCamel(key)]: value }), {
        accessToken: '',
        expired: false,
        expiresIn: 0,
        scope: '',
        tokenType: ''
      }))
  return accessToken
}

export const getAccessTokenClaims = (accessToken: AccessToken): JwtClaims => jwtDecode(accessToken.accessToken)

export const getLaunchUrl = (devServerUrl: string, bearerToken: BearerToken): string => {
  const decodedToken: JwtClaims = jwtDecode(bearerToken)
  const urlEncoded = devServerUrl === decodeURIComponent(devServerUrl) ? encodeURIComponent(devServerUrl) : devServerUrl
  const baseLaunchUrl = `${decodedToken.instanceUrl}/${decodedToken.principal.permission.workspaceName}/reporting/dev?url=${urlEncoded}#access_token=${bearerToken}`
  return baseLaunchUrl
}

export const createBundle = async (metadata: CustomReportMetadata, outDir: string): Promise<CustomReportProjectBundle> => {
  const metaFilename = 'lxreport.json'
  const bundleFilename = 'bundle.tgz'
  const targetFilePath = resolve(outDir, bundleFilename)
  if (!existsSync(outDir)) throw Error(`could not find outDir: ${outDir}`)
  writeFileSync(resolve(outDir, metaFilename), JSON.stringify(metadata))
  await c({ gzip: true, cwd: outDir, file: targetFilePath, filter: path => path !== bundleFilename }, readdirSync(outDir))

  const bundle = createReadStream(targetFilePath)
  return bundle
}

interface ReportUploadError {
  value: 'error'
  messages: string[]
}

type ResponseStatus = 'OK' | 'ERROR'

interface ResponseData {
  status: ResponseStatus
  type: string
  data?: unknown
  errorMessage?: string
  errors?: ReportUploadError[]
}

type ReportsResponseData = {
  data: CustomReportMetadata[]
  total: number
  endCursor: string
} & ResponseData
export interface ReportUploadResponseData {
  type: string
  status: ResponseStatus
  data: { id: ReportId }
  errorMessage?: string
  errors?: ReportUploadError[]
}

export const uploadBundle = async (params: {
  bundle: CustomReportProjectBundle
  bearerToken: BearerToken
  proxyURL?: string
  store?: {
    host?: string
    assetId: string
  }
}): Promise<ReportUploadResponseData> => {
  const { bundle, bearerToken, proxyURL, store } = params
  const storeHost = store?.host ?? 'store.leanix.net'
  const assetId = store?.assetId ?? null
  const decodedToken: JwtClaims = jwtDecode(bearerToken)
  const url = assetId !== null
    ? `https://${storeHost}/services/torg/v1/assetversions/${assetId}/payload`
    : `${decodedToken.instanceUrl}/services/pathfinder/v1/reports/upload`
  const headers = { Authorization: `Bearer ${bearerToken}` }
  const form = new FormData()
  form.append('file', bundle)
  const options: RequestInit = { method: 'post', headers, body: form }
  if (proxyURL !== undefined) options.agent = createProxyAgent(proxyURL)
  const reportResponseData: ReportUploadResponseData = await fetch(url, options)
    .then(async res => {
      const contentType: string | null = res.headers.get('content-type')
      const content = contentType === 'application/json'
        ? await res.json()
        : await res.text()
      if (!res.ok) throw Error(JSON.stringify({ status: res.status, message: content }))
      return content as ReportUploadResponseData
    })
  return reportResponseData
}

export const fetchWorkspaceReports = async (bearerToken: BearerToken, proxyURL?: string): Promise<CustomReportMetadata[]> => {
  const decodedToken: JwtClaims = jwtDecode(bearerToken)
  const headers = { Authorization: `Bearer ${bearerToken}` }
  const fetchReportsPage = async (cursor: string | null = null): Promise<ReportsResponseData> => {
    const url = new URL(`${decodedToken.instanceUrl}/services/pathfinder/v1/reports?sorting=updatedAt&sortDirection=DESC&pageSize=100`)
    if (cursor !== null) url.searchParams.append('cursor', cursor)
    const options: RequestInit = { method: 'get', headers }
    if (proxyURL !== undefined) options.agent = createProxyAgent(proxyURL)
    const reportsPage: ReportsResponseData = await fetch(url.toString(), options)
      .then(async res => await res.json() as ReportsResponseData)
    return reportsPage
  }
  const reports: CustomReportMetadata[] = []
  let cursor = null
  do {
    const reportResponseData: ReportsResponseData = await fetchReportsPage(cursor)
    if (reportResponseData.status !== 'OK') return await Promise.reject(reportResponseData)
    reports.push(...reportResponseData.data)
    cursor = reports.length < reportResponseData.total ? reportResponseData.endCursor : null
  } while (cursor !== null)
  return reports
}

export const deleteWorkspaceReportById = async (reportId: ReportId, bearerToken: BearerToken, proxyURL?: string): Promise<204 | number> => {
  const decodedToken: JwtClaims = jwtDecode(bearerToken)
  const headers = { Authorization: `Bearer ${bearerToken}` }
  const url = new URL(`${decodedToken.instanceUrl}/services/pathfinder/v1/reports/${reportId}`)
  const options: RequestInit = { method: 'delete', headers }
  if (proxyURL !== undefined) options.agent = createProxyAgent(proxyURL)
  const status = await fetch(url.toString(), options)
    .then(({ status }) => status)
  return status === 204 ? await Promise.resolve(status) : await Promise.reject(status)
}
