#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, readdirSync, lstatSync, rmdirSync, unlinkSync, statSync, copyFileSync } from 'fs'
import { join, resolve, relative } from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import prompts from 'prompts'
import { yellow, green, blue, red, cyan, magenta, lightRed } from 'kolorist'
import { validateDocument } from '@fazendadosoftware/lxr-core'

const cwd = process.cwd()

interface FrameworkVariant {
  name: string
  display: string
  color: (str: string | number) => string
}

interface Framework {
  name: string
  color: (str: string | number) => string
  variants: FrameworkVariant[]
}

const FRAMEWORKS: Framework[] = [
  {
    name: 'vanilla',
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
      }
    ]
  },
  {
    name: 'react',
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
    name: 'lit-element',
    color: lightRed,
    variants: [
      {
        name: 'lit-element',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'lit-element-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  },
  {
    name: 'svelte',
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
  }
]

const TEMPLATES = FRAMEWORKS
  .map(({ name, variants }) => Array.isArray(variants) ? variants.map(({ name }) => name) : [name])
  .flat()

/*
const TEMPLATES = FRAMEWORKS.map(({ variants }) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), [])
*/

const renameFiles: Record<string, string> = {
  _gitignore: '.gitignore'
}

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

const getLeanIXQuestions = (options?: Options): Array<prompts.PromptObject<string>> => ([
  {
    type: options?.reportId === undefined ? 'text' : null,
    name: 'reportId',
    message: 'Unique id for this report in Java package notation (e.g. net.leanix.barcharts)'
  },
  {
    type: options?.author === undefined ? 'text' : null,
    name: 'author',
    message: 'Who is the author of this report (e.g. LeanIX GmbH)'
  },
  {
    type: options?.title === undefined ? 'text' : null,
    name: 'title',
    message: 'A title to be shown in LeanIX when report is installed'
  },
  {
    type: options?.description === undefined ? 'text' : null,
    name: 'description',
    message: 'Description of your project'
  },
  {
    type: options?.host === undefined ? 'text' : null,
    name: 'host',
    initial: 'app.leanix.net',
    message: 'Which host do you want to work with?'
  },
  {
    type: options?.apitoken === undefined ? 'text' : null,
    name: 'apitoken',
    message: 'API-Token for Authentication (see: https://dev.leanix.net/docs/authentication#section-generate-api-tokens)'
  },
  {
    type: options?.proxyURL === undefined ? 'confirm' : null,
    name: 'behindProxy',
    message: 'Are you behind a proxy?',
    initial: false
  },
  {
    type: (prev: boolean) => prev && 'text',
    name: 'proxyURL',
    message: 'Proxy URL?'
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
          message: 'Project name:',
          initial: defaultProjectName,
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          onState: state => (targetDir = state.value.trim() || defaultProjectName)
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
          // @ts-expect-error
          type: (_, { overwrite } = {}) => {
            if (overwrite === false) throw new Error(red('✖') + ' Operation cancelled')
            return null
          },
          name: 'overwriteChecker'
        },
        {
          type: () => (targetDir !== null && isValidPackageName(targetDir) ? null : 'text'),
          name: 'packageName',
          message: 'Package name:',
          initial: () => toValidPackageName(targetDir ?? ''),
          validate: dir => isValidPackageName(dir) || 'Invalid package.json name'
        },
        {
          type: (template != null) && TEMPLATES.includes(template) ? null : 'select',
          name: 'framework',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? `"${template}" isn't a valid template. Please choose from below: `
              : 'Select a framework:',
          initial: 0,
          choices: FRAMEWORKS.map((framework: Framework) => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.name),
              value: framework
            }
          })
        },
        {
          type: framework => framework?.variants !== undefined ? 'select' : null,
          name: 'variant',
          message: 'Select a variant:',
          choices: (framework: Framework) => framework.variants
            .map(variant => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.name),
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
  const { framework, overwrite, packageName, variant } = result;
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
  if (template === null) throw Error('unknown template')

  console.log(`\nScaffolding project in ${root}...`)

  const templateDir = join(__dirname, 'templates', template)

  const write = (file: string, content?: string): void => {
    const targetPath = join(root, renameFiles[file] ?? file)
    if (content !== undefined) writeFileSync(targetPath, content)
    else copy(join(templateDir, file), targetPath)
  }

  readdirSync(templateDir).filter(f => f !== 'package.json').forEach(file => write(file))

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let pkg = require(join(templateDir, 'package.json'))

  const reportName = packageName ?? targetDir

  const pkgMetadataFields = { name: reportName, author, description, version: pkg.version }
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
    .forEach(([filename, content]) => write(filename, JSON.stringify(content, null, 2) + '\n'))

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo?.name ?? 'npm'

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

/**
 * @param {string | undefined} userAgent process.env.npm_config_user_agent
 * @returns object | undefined
 */
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
