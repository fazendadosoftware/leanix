import fetch from 'node-fetch'
import jwtDecode from 'jwt-decode'
import FormData from 'form-data'
import { c } from 'tar'
import { resolve } from 'path'
import { existsSync, writeFileSync, readdirSync, createReadStream, ReadStream, readFileSync } from 'fs'
import { URL } from 'url'
import { validate } from 'jsonschema'

export { validate, ValidationError } from 'jsonschema'

export type LeanIXHost = string
export type LeanIXApiToken = string
export type BearerToken = string
export type LeanIXWorkspaceId = string
export type LeanIXWorkspaceName = string
export type CustomReportProjectBundle = ReadStream
export type ReportId = string
export type ReportName = string
export type ReportTitle = string
export type ReportVersion = string
export type ReportDescription = string
export type ReportAuthor = string
export type ReportDocumentationLink = string
export type ReportConfig = object

export interface LeanIXCredentials {
  host: LeanIXHost
  apitoken: LeanIXApiToken
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

export const readLxrJson = async (path?: string): Promise<LeanIXCredentials> => {
  if ((path ?? '').length === 0) path = `${process.cwd()}/lxr.json`
  const { host, apitoken } = JSON.parse(path !== undefined ? readFileSync(path).toString() : '{}')
  const credentials: LeanIXCredentials = { host, apitoken }
  const schema = await import('./schema/LeanIXCredentials.json')
  validate(credentials, schema, { throwAll: true })
  return credentials
}

export const readMetadataJson = async (path: string = `${process.cwd()}/lxreport.json`): Promise<CustomReportMetadata> => {
  const fileContent = readFileSync(path).toString()
  const parsedContent = JSON.parse(fileContent)
  const schema = await import('./schema/CustomReportMetadata.json')
  validate(parsedContent, schema, { throwAll: true })
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
