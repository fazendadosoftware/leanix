import test, { ExecutionContext } from 'ava'
import { createServer, build } from 'vite'
import { resolve } from 'path'
import { writeFileSync, rmdirSync, existsSync, mkdirSync, readdirSync, createReadStream } from 'fs'
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

const deleteExistingReportInWorkspace = async (t: ExecutionContext | null, accessToken: AccessToken | null): Promise<AccessToken> => {
  const { id, version } = getDummyReportMetadata()
  const credentials = await readLxrJson()
  if (accessToken === null) accessToken = await getAccessToken(credentials)
  const reports = await fetchWorkspaceReports(accessToken.accessToken)
  const { id: reportId = null } = reports.find(({ reportId, version: reportVersion }) => reportId === id && reportVersion === version) ?? {}
  if (reportId !== null) {
    const status = await deleteWorkspaceReportById(reportId, accessToken.accessToken)
    if (status === 204) t?.log('Deleted existing report in workspace')
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    else t?.log(`Error deleting report in workspace. Got ${status}`)
  }
  return accessToken
}

test.before(async t => {
  if (existsSync(tmpDir)) rmdirSync(tmpDir, { recursive: true })
  mkdirSync(tmpDir, { recursive: true })
  accessToken = await deleteExistingReportInWorkspace(t, accessToken)
})

test.after.always('cleanup', async t => {
  rmdirSync(tmpDir, { recursive: true })
  await deleteExistingReportInWorkspace(t, accessToken)
})

test('plugin gets the launch url in development', async t => {
  t.timeout(10000, 'timeout occurred!')

  const plugin = leanixPlugin()
  const server = await createServer({ plugins: [plugin] })

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

test('plugin creates bundle file "bundle.tgz" when building', async t => {
  t.timeout(10000, 'timeout occurred!')

  const testBaseDir: string = resolve(tmpDir, uuid())

  const folders: Record<string, string> = Object.entries({ srcDir: `${testBaseDir}/src`, outDir: `${testBaseDir}/dist` })
    .reduce((accumulator, [key, value]) => ({ ...accumulator, [key]: resolve(testBaseDir, value) }), {})

  Object.values(folders).forEach(path => {
    if (existsSync(path)) rmdirSync(path, { recursive: true })
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
  t.is(typeof chunk, 'object', 'chunk is an object')

  const assetFilename: string = (chunk.fileName ?? '').split('/')[1]
  t.true(assetFilename !== undefined, 'assetFilename is not undefined')

  const outDirEntries = readdirSync(folders.outDir)
  const assetsDirEntries = readdirSync(assetsDir)

  t.true(outDirEntries.length === 4, 'outDir has 4 entries')
  t.true(assetsDirEntries.length === 1, 'assetsDir has 1 entry')
  t.is(assetsDirEntries[0], assetFilename, 'generate asset file is in assets folder')

  t.true(outDirEntries.includes('bundle.tgz'), '"bundle.tgz" was generated')
  const fileStream = createReadStream(resolve(folders.outDir, 'bundle.tgz'))

  const bundleFiles = await new Promise<ReadEntry[]>((resolve, reject) => {
    const entries: ReadEntry[] = []
    fileStream.on('open', () => fileStream.pipe(tarT()).on('entry', entry => entries.push(entry)))
    fileStream.on('error', err => reject(err))
    fileStream.on('end', () => { resolve(entries) })
  })

  t.is(bundleFiles.length, 4, 'bundle file has 4 entries')
  const assetDirectory = bundleFiles.find(({ path, type }) => type === 'Directory' && path === `${assetsFolder}/`)
  t.true(assetDirectory !== undefined, `bundle includes asset directory "/${assetsFolder}"`)
  const indexHtmlFile = bundleFiles.find(({ path, type }) => type === 'File' && path === 'index.html')
  t.true(indexHtmlFile !== undefined, 'bundle includes file "index.html"')
  const metadataJsonFile = bundleFiles.find(({ path, type }) => type === 'File' && path === 'lxreport.json')
  t.true(metadataJsonFile !== undefined, 'bundle includes metadata file "lxreport.json"')
  const assetFile = bundleFiles.find(({ path, type }) => type === 'File' && path === `${assetsFolder}/${assetFilename}`)
  t.true(assetFile !== undefined, `bundle includes generated asset file "${assetsFolder}/${assetFilename}"`)

  Object.values(folders).forEach(path => rmdirSync(path, { recursive: true }))
})
