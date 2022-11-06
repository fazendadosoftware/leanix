#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, lstatSync, rmdirSync, unlinkSync, statSync, copyFileSync } from 'fs'
import { readdir, writeFile } from 'fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'url'
import { join, resolve, relative } from 'path'
import prompts from 'prompts'
import spawn from 'cross-spawn'
import { yellow, green, blue, red, cyan, magenta, reset } from 'kolorist'
import { validateDocument } from 'lxr-core'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

interface Options {
  targetDir?: string
  template?: string
  reportId?: string
  author?: string
  title?: string
  description?: string
  host?: string
  apitoken?: string
  proxyURL?: string
}

interface PromptResult extends Options {
  packageName?: string
  overwrite?: boolean
  framework?: string
  variant?: string
}

const cwd = process.cwd()

type ColorFunc = (str: string | number) => string

interface IFrameworkBase {
  name: string
  display: string
  color: ColorFunc
}

interface IFrameworkVariant extends IFrameworkBase {
  customCommand?: string
}

interface IFramework extends IFrameworkBase {
  variants: IFrameworkVariant[]
}

const FRAMEWORKS: IFramework[] = [
  {
    name: 'vanilla',
    display: 'Vanilla',
    color: yellow,
    variants: [
      {
        name: 'vanilla',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'vanilla-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  },
  {
    name: 'vue',
    display: 'Vue',
    color: green,
    variants: [
      {
        name: 'vue',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'vue-ts',
        display: 'TypeScript',
        color: blue
      },
      {
        name: 'custom-create-vue',
        display: 'Customize with create-vue ↗',
        color: green,
        customCommand: 'npm create vue@latest TARGET_DIR'
      }
    ]
  },
  {
    name: 'react',
    display: 'React',
    color: cyan,
    variants: [
      {
        name: 'react',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'react-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  },
  {
    name: 'preact',
    display: 'Preact',
    color: magenta,
    variants: [
      {
        name: 'preact',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'preact-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  },
  {
    name: 'svelte',
    display: 'Svelte',
    color: red,
    variants: [
      {
        name: 'svelte',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'svelte-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  },
  {
    name: 'others',
    display: 'Others',
    color: reset,
    variants: [
      {
        name: 'create-vite-extra',
        display: 'create-vite-extra ↗',
        color: reset,
        customCommand: 'npm create vite-extra@latest TARGET_DIR'
      }
    ]
  }
]

const TEMPLATES = FRAMEWORKS
  .map(({ name, variants }) => Array.isArray(variants) ? variants.map(({ name }) => name) : [name])
  .flat()

const renameFiles: Record<string, string> = {
  _gitignore: '.gitignore'
}

const getLeanIXQuestions = (options: Options): Array<prompts.PromptObject<string>> => ([
  {
    type: options?.reportId === undefined ? 'text' : null,
    name: 'reportId',
    message: reset('Unique id for this report in Java package notation (e.g. net.leanix.barcharts)')
  },
  {
    type: options?.author === undefined ? 'text' : null,
    name: 'author',
    message: reset('Who is the author of this report (e.g. LeanIX GmbH)')
  },
  {
    type: options?.title === undefined ? 'text' : null,
    name: 'title',
    message: reset('A title to be shown in LeanIX when report is installed')
  },
  {
    type: options?.description === undefined ? 'text' : null,
    name: 'description',
    message: reset('Description of your project')
  },
  {
    type: options?.host === undefined ? 'text' : null,
    name: 'host',
    initial: 'app.leanix.net',
    message: reset('Which host do you want to work with?')
  },
  {
    type: options?.apitoken === undefined ? 'text' : null,
    name: 'apitoken',
    message: reset('API-Token for Authentication (see: https://dev.leanix.net/docs/authentication#section-generate-api-tokens)')
  },
  {
    type: options?.proxyURL === undefined ? 'confirm' : null,
    name: 'behindProxy',
    message: reset('Are you behind a proxy?'),
    initial: false
  },
  {
    type: (prev: boolean) => prev && 'text',
    name: 'proxyURL',
    message: reset('Proxy URL?')
  }
])

async function init (argv: Options): Promise<void> {
  let { targetDir = null, template = null } = argv
  // leanix-specific answers
  let { reportId, author, title, description, host, apitoken, proxyURL } = argv

  const defaultProjectName = targetDir ?? 'leanix-custom-report'

  let result: PromptResult = {}

  try {
    result = await prompts(
      [
        {
          type: targetDir !== null ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultProjectName,
          onState: state => (targetDir = state.value.trim() ?? defaultProjectName)
        },
        {
          type: () => targetDir !== null && (!existsSync(targetDir) || isEmpty(targetDir)) ? null : 'confirm',
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? 'Current directory'
              : `Target directory "${targetDir ?? ''}"`) +
            ' is not empty. Remove existing files and continue?'
        },
        {
          type: (_, { overwrite }: { overwrite?: boolean }) => {
            if (overwrite === false) throw new Error(red('✖') + ' Operation cancelled')
            return null
          },
          name: 'overwriteChecker'
        },
        {
          type: () => (targetDir !== null && isValidPackageName(targetDir) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          initial: () => toValidPackageName(targetDir ?? ''),
          validate: dir => isValidPackageName(dir) ?? 'Invalid package.json name'
        },
        {
          type: (template != null) && TEMPLATES.includes(template) ? null : 'select',
          name: 'framework',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? reset(`"${template}" isn't a valid template. Please choose from below: `)
              : reset('Select a framework:'),
          initial: 0,
          choices: FRAMEWORKS.map(framework => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.display ?? framework.name),
              value: framework
            }
          })
        },
        {
          type: (framework: IFramework) => framework?.variants !== undefined ? 'select' : null,
          name: 'variant',
          message: reset('Select a variant:'),
          choices: (framework: IFramework) => framework.variants
            .map(variant => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.display ?? variant.name),
                value: variant.name
              }
            })
        },
        ...getLeanIXQuestions(argv)
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled')
        }
      }
    )
  } catch (cancelled: any) {
    console.log(cancelled?.message)
    return
  }

  // user choice associated with prompts
  const { framework, overwrite, packageName, variant = null } = result;
  // leanix-specific answers
  ({
    reportId = reportId,
    author = author,
    title = title,
    description = description,
    host = host,
    apitoken = apitoken,
    proxyURL = proxyURL
  } = result)

  const root = join(cwd, targetDir ?? '')

  if (overwrite === true) emptyDir(root)
  else if (!existsSync(root)) mkdirSync(root)

  // determine template
  template = variant ?? framework ?? template
  if (template === null) throw new Error('unknown template')

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent) ?? null
  const pkgManager = (pkgInfo != null) ? pkgInfo.name : 'npm'
  const isYarn1 = (pkgManager === 'yarn' && pkgInfo?.version.startsWith('1.')) ?? false

  const { customCommand = null } = FRAMEWORKS.flatMap(f => f.variants).find((v) => v.name === template) ?? {}

  if (customCommand !== null) {
    const fullCustomCommand = customCommand
      .replace('TARGET_DIR', root)
      .replace(/^npm create/, `${pkgManager} create`)
      // Only Yarn 1.x doesn't support `@version` in the `create` command
      .replace('@latest', () => (isYarn1 ? '' : '@latest'))
      .replace(/^npm exec/, () => {
        // Prefer `pnpm dlx` or `yarn dlx`
        if (pkgManager === 'pnpm') {
          return 'pnpm dlx'
        }
        if (pkgManager === 'yarn' && !isYarn1) {
          return 'yarn dlx'
        }
        // Use `npm exec` in all other cases,
        // including Yarn 1.x and other custom npm clients.
        return 'npm exec'
      })

    const [command, ...args] = fullCustomCommand.split(' ')
    const { status } = spawn.sync(command, args, {
      stdio: 'inherit'
    })
    process.exit(status ?? 0)
  }

  console.log(`\nScaffolding project in ${root}...`)

  const templateDir = join(__dirname, 'templates', template)

  const write = async (file: string, content?: string): Promise<void> => {
    const targetPath = join(root, renameFiles[file] ?? file)
    if (content !== undefined) await writeFile(pathToFileURL(targetPath), content)
    else copy(join(templateDir, file), targetPath)
  }

  const templateFiles = await readdir(pathToFileURL(templateDir))
  for (const file of templateFiles.filter(f => f !== 'package.json')) {
    await write(file)
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // let pkg = require(join(templateDir, 'package.json'))
  let pkg = JSON.parse(readFileSync(path.join(templateDir, 'package.json'), 'utf-8'))

  const pkgMetadataFields = { name: packageName ?? targetDir, author, description, version: pkg.version }
  const leanixReport = { id: reportId, title, defaultConfig: {} }

  pkg = { ...pkg, ...pkgMetadataFields, leanixReport }
  await validateDocument({ ...leanixReport, ...pkgMetadataFields }, 'lxreport.json')

  const lxrJson = { host, apitoken, proxyURL }

  await validateDocument(lxrJson, 'lxr.json')

  const generatedFiles: Record<string, object> = {
    'package.json': pkg,
    'lxr.json': lxrJson
  }

  Object.entries(generatedFiles)
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .forEach(async ([filename, content]) => await write(filename, JSON.stringify(content, null, 2) + '\n'))

  console.log('\nDone. Now run:\n')
  if (root !== cwd) {
    console.log(`  cd ${relative(cwd, root)}`)
  }
  switch (pkgManager) {
    case 'yarn':
      console.log('  yarn')
      console.log('  yarn dev')
      break
    default:
      console.log(`  ${pkgManager} install`)
      console.log(`  ${pkgManager} run dev`)
      break
  }
  console.log()
}

const copy = (src: string, dest: string): void => {
  const stat = statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    copyFileSync(src, dest)
  }
}

const isValidPackageName = (projectName: string): boolean => /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/
  .test(projectName)

const toValidPackageName = (projectName: string): string => projectName
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/^[._]/, '')
  .replace(/[^a-z0-9-~]+/g, '-')

const copyDir = (srcDir: string, destDir: string): void => {
  mkdirSync(destDir, { recursive: true })
  for (const file of readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

const isEmpty = (path: string): boolean => readdirSync(path).length === 0

const emptyDir = (dir: string): void => {
  if (!existsSync(dir)) return
  readdirSync(dir)
    .forEach(file => {
      const abs = resolve(dir, file)
      // baseline is Node 12 so can't use rmSync :(
      if (lstatSync(abs).isDirectory()) {
        emptyDir(abs)
        rmdirSync(abs)
      } else unlinkSync(abs)
    })
}

const pkgFromUserAgent = (userAgent?: string): { name: string, version: string } | undefined => {
  if (userAgent === undefined) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return { name: pkgSpecArr[0], version: pkgSpecArr[1] }
}

const getCliOptions = (): any => ({
  template: {
    description: 'The template to be used',
    alias: 't'
  },
  reportId: {
    description: 'Unique id for this report in Java package notation (e.g. net.leanix.barcharts)'
  },
  author: {
    description: 'Who is the author of this report (e.g. LeanIX GmbH <support@leanix.net>)'
  },
  title: {
    description: 'A title to be shown in LeanIX when report is installed'
  },
  description: {
    description: 'Description of your project'
  },
  host: {
    description: 'Which host do you want to work with?'
  },
  apitoken: {
    description: 'API-Token for Authentication (see: https://dev.leanix.net/docs/authentication#section-generate-api-tokens)'
  },
  proxyURL: {
    description: 'Are you behind a proxy? Enter its URL here.'
  }
})

// eslint-disable-next-line no-void
void yargs(hideBin(process.argv))
  .usage('Usage: $0 [targetDir] [options]')
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .command('* [targetDir] [options]', 'the default command', () => { }, async (argv: any) => await init(argv).catch(e => console.error(e)))
  // .positional('targetDir', { describe: 'The folder in which the project will be created' })
  .options(getCliOptions())
  .argv
