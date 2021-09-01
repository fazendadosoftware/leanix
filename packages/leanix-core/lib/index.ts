import fetch from 'node-fetch'
import jwtDecode from 'jwt-decode'
import FormData from 'form-data'
import { c } from 'tar'
import { resolve } from 'path'
import { existsSync, writeFileSync, readdirSync, createReadStream, ReadStream, readFileSync } from 'fs'
import { URL } from 'url'
import { validate, ValidatorResult } from 'jsonschema'
import LeanIXCredentialsSchema from './schema/LeanIXCredentials.json'
import CustomReportMetadataSchema from './schema/CustomReportMetadata.json'

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
type ReportDocumentationLink = string
type ReportConfig = object
export type CustomReportProjectBundle = ReadStream

export interface LeanIXCredentials {
  host: LeanIXHost
  apitoken: LeanIXApiToken
  proxyURL?: string
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
  documentationLink: ReportDocumentationLink
  defaultConfig: ReportConfig
}

const snakeToCamel = (s: string): string => s.replace(/([-_]\w)/g, g => g[1].toUpperCase())

// utility function for validating "lxr.json" and "lxreport.json" files
export const validateDocument = async (document: any, name: 'lxr.json' | 'lxreport.json'): Promise<ValidatorResult> => {
  let schema: any
  switch (name) {
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
  const result = validate(document, schema, { throwAll: true })
  return result
}

export const readLxrJson = async (path?: string): Promise<LeanIXCredentials> => {
  if ((path ?? '').length === 0) path = `${process.cwd()}/lxr.json`
  const { host, apitoken } = JSON.parse(path !== undefined ? readFileSync(path).toString() : '{}')
  const credentials: LeanIXCredentials = { host, apitoken }
  await validateDocument(credentials, 'lxr.json')
  validate(credentials, LeanIXCredentialsSchema, { throwAll: true })
  return credentials
}

export const readMetadataJson = async (path: string = `${process.cwd()}/package.json`): Promise<CustomReportMetadata> => {
  const fileContent = readFileSync(path).toString()
  const parsedContent = JSON.parse(fileContent)
  if (parsedContent.leanixReport === 'undefined') throw Error('💥 could not find leanixReport attribute in package.json...')
  const { name, version, leanixReport = {} } = parsedContent
  const metadata = { name, version, ...leanixReport }
  await validateDocument(metadata, 'lxreport.json')
  return parsedContent
}

export const getAccessToken = async (credentials: LeanIXCredentials): Promise<AccessToken> => {
  const uri = `https://${credentials.host}/services/mtm/v1/oauth2/token?grant_type=client_credentials`
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from('apitoken:' + credentials.apitoken).toString('base64')}`
  }
  const accessToken: AccessToken = await fetch(uri, { method: 'post', headers })
    .then(async res => {
      const content = await res[res.headers.get('content-type') === 'application/json' ? 'json' : 'text']()
      return res.ok ? content : await Promise.reject(res.status)
    })
    .then(accessToken => Object.entries(accessToken)
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

  const bundle = await createReadStream(targetFilePath)
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
  data?: any
  errorMessage?: string
  errors?: ReportUploadError[]
}

interface ReportsResponseData extends ResponseData {
  data: CustomReportMetadata[]
  total: number
  endCursor: string
}
export interface ReportUploadResponseData {
  type: string
  status: ResponseStatus
  data: { id: ReportId }
  errorMessage?: string
  errors?: ReportUploadError[]
}

export const uploadBundle = async (bundle: CustomReportProjectBundle, bearerToken: BearerToken): Promise<ReportUploadResponseData> => {
  const decodedToken: JwtClaims = jwtDecode(bearerToken)
  const url = `${decodedToken.instanceUrl}/services/pathfinder/v1/reports/upload`
  const headers = { Authorization: `Bearer ${bearerToken}` }
  const form = new FormData()
  form.append('file', bundle)
  const reportResponseData: ReportUploadResponseData = await fetch(url, { method: 'post', headers, body: form })
    .then(async res => await res.json())
  return reportResponseData
}

export const fetchWorkspaceReports = async (bearerToken: BearerToken): Promise<CustomReportMetadata[]> => {
  const decodedToken: JwtClaims = jwtDecode(bearerToken)
  const headers = { Authorization: `Bearer ${bearerToken}` }
  const fetchReportsPage = async (cursor: string | null = null): Promise<ReportsResponseData> => {
    const url = new URL(`${decodedToken.instanceUrl}/services/pathfinder/v1/reports?sorting=updatedAt&sortDirection=DESC&pageSize=100`)
    if (cursor !== null) url.searchParams.append('cursor', cursor)
    const reportsPage: ReportsResponseData = await fetch(url, { method: 'get', headers })
      .then(async res => await res.json())
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

export const deleteWorkspaceReportById = async (reportId: ReportId, bearerToken: BearerToken): Promise<204 | number> => {
  const decodedToken: JwtClaims = jwtDecode(bearerToken)
  const headers = { Authorization: `Bearer ${bearerToken}` }
  const url = new URL(`${decodedToken.instanceUrl}/services/pathfinder/v1/reports/${reportId}`)
  const status = await fetch(url, { method: 'delete', headers })
    .then(({ status }) => status)
  return status === 204 ? await Promise.resolve(status) : await Promise.reject(status)
}
