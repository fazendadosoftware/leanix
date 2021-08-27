import test from 'ava'
import { commandSync, ExecaSyncReturnValue, SyncOptions } from 'execa'
import { mkdirpSync, readdirSync, remove, writeFileSync, statSync } from 'fs-extra'
import { join } from 'path'

const CLI_PATH = join(__dirname, '.')

const projectName = 'test-app'
const genPath = join(__dirname, projectName)

const run = (
  args: string[],
  options: SyncOptions<string> = {}
): ExecaSyncReturnValue<string> => {
  return commandSync(`node ${CLI_PATH} ${args.join(' ')}`, options)
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

// Vue 3 starter template plus 2 leanix-specific generated files: 'lxr.json' and 'lxreport.json'
const templateFiles = [...getAllFiles(join(CLI_PATH, 'templates', 'vue')), 'lxreport.json', 'lxr.json']
  .map(file => file === '_gitignore' ? '.gitignore' : file)
  .sort()

test.beforeEach(async () => await remove(genPath))
test.after.always(async () => await remove(genPath))

test('prompts for the project name if none supplied', t => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stdout, exitCode } = run([])
  t.true(stdout.includes('Project name:'))
})

test('prompts for the framework if none supplied', t => {
  const { stdout } = run([projectName])
  t.true(stdout.includes('Select a framework:'))
})

test('prompts for the framework on not supplying a value for --template', t => {
  const { stdout } = run([projectName, '--template'])
  t.true(stdout.includes('Select a framework:'))
})

test('prompts for the framework on supplying an invalid template', t => {
  const { stdout } = run([projectName, '--template', 'unknown'])
  t.true(stdout.includes('"unknown" isn\'t a valid template. Please choose from below:'))
})

test('asks to overwrite non-empty target directory', t => {
  createNonEmptyDir()
  const { stdout } = run([projectName], { cwd: __dirname })
  t.true(stdout.includes(`Target directory "${projectName}" is not empty.`))
})

test('asks to overwrite non-empty current directory', t => {
  createNonEmptyDir()
  const { stdout } = run(['.'], { cwd: genPath, input: 'test-app\n' })
  t.true(stdout.includes('Current directory is not empty.'))
})

test.serial('successfully scaffolds a project based on vue starter template', async t => {
  const args = [
    '--template', 'vue',
    '---reportId', 'net.leanix.report',
    '--author', 'LeanIX GmbH',
    '--title', 'Report Title',
    '--description', 'Report Description',
    '--host', 'app.leanix.net',
    '--apitoken', 'apitoken',
    '--proxyURL', 'iojfowjio'
  ]
  const { stdout, stderr } = run([projectName, ...args], { cwd: __dirname })

  const generatedFiles = getAllFiles(genPath).sort()

  // Assertions
  t.true(stdout.includes(`Scaffolding project in ${genPath}`))
  t.deepEqual(generatedFiles, templateFiles)
})
