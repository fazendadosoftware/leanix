import { expect, test, beforeAll, afterAll } from 'vitest'
// import test, { ExecutionContext } from 'ava'
import { createServer, build } from 'vite'
import { resolve } from 'path'
import { writeFileSync, rmSync, existsSync, mkdirSync, readdirSync, createReadStream } from 'fs'
import { ReadEntry, t as tarT } from 'tar'
import { v4 as uuid } from 'uuid'
import { CustomReportMetadata, fetchWorkspaceReports, deleteWorkspaceReportById, readLxrJson, getAccessToken, AccessToken } from '../../lxr-core/lib/index'
import leanixPlugin from './index'

const tmpDir = resolve(__dirname, '../.temp')

const getDummyReportMetadata = (): CustomReportMetadata => ({
  id: 'net.fazendadosoftware.testReport',
  name: 'custom-report-name',
  title: 'Fazenda do Software Test Report',
  version: '0.1.0',
  description: 'Custom Report Description',
  author: 'John Doe',
  defaultConfig: {}
})

let accessToken: AccessToken | null = null

const deleteExistingReportInWorkspace = async (accessToken: AccessToken | null): Promise<AccessToken> => {
  const { id, version } = getDummyReportMetadata()
  const credentials = await readLxrJson()
  if (accessToken === null) accessToken = await getAccessToken(credentials)
  const reports = await fetchWorkspaceReports(accessToken.accessToken)
  const { id: reportId = null } = reports.find(({ reportId, version: reportVersion }) => reportId === id && reportVersion === version) ?? {}
  if (reportId !== null) {
    const status = await deleteWorkspaceReportById(reportId, accessToken.accessToken)
    if (status === 204) console.log('Deleted existing report in workspace')
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    else console.log(`Error deleting report in workspace. Got ${status}`)
  }
  return accessToken
}

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
  mkdirSync(tmpDir, { recursive: true })
  accessToken = await deleteExistingReportInWorkspace(accessToken)
})

afterAll(async () => {
  rmSync(tmpDir, { recursive: true })
  await deleteExistingReportInWorkspace(accessToken)
})

test('plugin gets the launch url in development', async () => {
  const plugin = leanixPlugin()
  const server = await createServer({ plugins: [plugin] })

  await server.listen()
  const interval = setInterval(() => console.log('Waiting for launch url...'), 1000)
  while (plugin.launchUrl === null) await new Promise<void>(resolve => setTimeout(() => resolve(), 100))
  clearInterval(interval)

  const url = new URL(plugin.launchUrl)
  const devServerUrl = url.searchParams.get('url')

  expect(url.protocol).toBe('https:')
  expect(devServerUrl).toBe(plugin.devServerUrl)
  await server.close()
}, 10000)

test('plugin creates bundle file "bundle.tgz" when building', async () => {
  const testBaseDir: string = resolve(tmpDir, uuid())

  const folders: Record<string, string> = Object.entries({ srcDir: `${testBaseDir}/src`, outDir: `${testBaseDir}/dist` })
    .reduce((accumulator, [key, value]) => ({ ...accumulator, [key]: resolve(testBaseDir, value) }), {})

  Object.values(folders).forEach(path => {
    if (existsSync(path)) rmSync(path, { recursive: true })
    mkdirSync(path, { recursive: true })
  })

  const { name, author, description, version, ...leanixReport } = getDummyReportMetadata()
  const projectFiles = {
    'index.js': 'console.log("hello world")',
    'index.html': '<html><body>Hello world<script type="module" src="./index.js"></script></body></html>',
    'package.json': JSON.stringify({ name, version, author, description, leanixReport })
  }

  Object.entries(projectFiles)
    .forEach(([filename, content]) => writeFileSync(resolve(folders.srcDir, filename), content))

  const assetsFolder = 'assets'
  const assetsDir = resolve(folders.outDir, assetsFolder)

  const output: any = await build({
    root: folders.srcDir,
    build: { outDir: folders.outDir, assetsDir: assetsFolder },
    plugins: [leanixPlugin({ packageJsonPath: resolve(folders.srcDir, 'package.json') })]
  })

  const chunk = output?.output.find((t: any) => t?.type === 'chunk')
  expect(typeof chunk).toBe('object')

  const assetFilename: string = (chunk.fileName ?? '').split('/')[1]
  expect(assetFilename).not.toBeUndefined()

  const outDirEntries = readdirSync(folders.outDir)
  const assetsDirEntries = readdirSync(assetsDir)

  expect(outDirEntries.length).toBe(4)
  expect(assetsDirEntries.length).toBe(1)
  expect(assetsDirEntries[0]).toBe(assetFilename)
  expect(outDirEntries.includes('bundle.tgz')).toBe(true)

  const fileStream = createReadStream(resolve(folders.outDir, 'bundle.tgz'))

  const bundleFiles = await new Promise<ReadEntry[]>((resolve, reject) => {
    const entries: ReadEntry[] = []
    fileStream.on('open', () => fileStream.pipe(tarT()).on('entry', entry => entries.push(entry)))
    fileStream.on('error', err => reject(err))
    fileStream.on('end', () => { resolve(entries) })
  })
  expect(bundleFiles.length).toBe(4)

  const assetDirectory = bundleFiles.find(({ path, type }) => type === 'Directory' && path === `${assetsFolder}/`)
  expect(assetDirectory).not.toBeUndefined()

  const indexHtmlFile = bundleFiles.find(({ path, type }) => type === 'File' && path === 'index.html')
  expect(indexHtmlFile).not.toBeUndefined()

  const metadataJsonFile = bundleFiles.find(({ path, type }) => type === 'File' && path === 'lxreport.json')
  expect(metadataJsonFile).not.toBeUndefined()

  const assetFile = bundleFiles.find(({ path, type }) => type === 'File' && path === `${assetsFolder}/${assetFilename}`)
  expect(assetFile).not.toBeUndefined()

  Object.values(folders).forEach(path => rmSync(path, { recursive: true }))
}, 10000)
