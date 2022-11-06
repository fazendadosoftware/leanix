import { expect, test, beforeEach, afterAll } from 'vitest'
import { execaCommandSync, ExecaSyncReturnValue, SyncOptions } from 'execa'
import { mkdirpSync, readdirSync, writeFileSync, statSync } from 'fs-extra'
import { rmSync, existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { generate as uuid } from 'short-uuid'
import pkg from '../package.json'

const CLI_PATH = resolve(__dirname, '..', pkg.bin)

const projectName = 'test-app'
const genPath = join(__dirname, projectName)

const run = (
  args: string[],
  options: SyncOptions<string> = {}
): ExecaSyncReturnValue<string> => {
  console.log(args.join(' '))
  return execaCommandSync(`node ${CLI_PATH} ${args.join(' ')}`, options)
}

// Helper to create a non-empty directory
const createNonEmptyDir = (): void => {
  // Create the temporary directory
  mkdirpSync(genPath)

  // Create a package.json file
  const pkgJson = join(genPath, 'package.json')
  writeFileSync(pkgJson, '{ "foo": "bar" }')
}

// Get all file names in a directory, recursively
const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
  readdirSync(dirPath).forEach(file => {
    statSync(dirPath + '/' + file).isDirectory()
      ? arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles)
      : arrayOfFiles.push(file)
  })
  return arrayOfFiles
}

const getPackageJson = (dirPath: string): any => JSON.parse(readFileSync(join(dirPath, 'package.json')).toString())

// Vue 3 starter template plus 1 generated file: 'lxr.json'
const templateFiles = [...getAllFiles(join(CLI_PATH, '..', 'templates', 'vue')), 'lxr.json']
  .map(file => file === '_gitignore' ? '.gitignore' : file)
  .sort()

beforeEach(() => { if (existsSync(genPath)) rmSync(genPath, { recursive: true }) })
afterAll(() => { if (existsSync(genPath)) rmSync(genPath, { recursive: true }) })

test('prompts for the project name if none supplied', t => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stdout, exitCode } = run([])
  expect(stdout.includes('Project name:')).toBe(true)
})

test('prompts for the framework if none supplied', t => {
  const { stdout } = run([projectName])
  expect(stdout.includes('Select a framework:')).toBe(true)
})

test('prompts for the framework on not supplying a value for --template', t => {
  const { stdout } = run([projectName, '--template'])
  expect(stdout.includes('Select a framework:')).toBe(true)
})

test('prompts for the framework on supplying an invalid template', t => {
  const { stdout } = run([projectName, '--template', 'unknown'])
  expect(stdout.includes('"unknown" isn\'t a valid template. Please choose from below:')).toBe(true)
})

test('asks to overwrite non-empty target directory', t => {
  createNonEmptyDir()
  const { stdout } = run([projectName], { cwd: __dirname })
  expect(stdout.includes(`Target directory "${projectName}" is not empty.`)).toBe(true)
})

test('asks to overwrite non-empty current directory', t => {
  createNonEmptyDir()
  const { stdout } = run(['.'], { cwd: genPath, input: 'test-app\n' })
  expect(stdout.includes('Current directory is not empty.')).toBe(true)
})

test('successfully scaffolds a project based on vue starter template', async () => {
  const template = 'vue'
  const reportId = uuid()
  const author = uuid()
  const title = uuid()
  const description = uuid()
  const host = uuid()
  const apitoken = uuid()
  const proxyURL = uuid()

  const args = [
    '--template', template,
    '--reportId', reportId,
    '--author', author,
    '--title', title,
    '--description', description,
    '--host', host,
    '--apitoken', apitoken,
    '--proxyURL', proxyURL
  ]

  const { stdout, stderr } = run([projectName, ...args], { cwd: __dirname })
  expect(typeof stderr).equal('string')

  const generatedFiles = getAllFiles(genPath).sort()

  // Assertions
  expect(stdout.includes(`Scaffolding project in ${genPath}`)).toBe(true)
  expect(generatedFiles).toEqual(templateFiles)

  const pkg = getPackageJson(genPath)
  expect(pkg.name).toEqual(projectName)
  expect(pkg.author).toEqual(author)
  expect(pkg.description).toEqual(description)
  expect(pkg.version).toEqual('0.0.0')
  expect(pkg?.leanixReport?.id).toEqual(reportId)
  expect(pkg?.leanixReport?.title).toEqual(title)
  expect(typeof pkg?.leanixReport.defaultConfig).toEqual('object')
})
