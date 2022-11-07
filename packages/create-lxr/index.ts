#!/usr/bin/env node
import * as fs from 'node:fs'

import minimist from 'minimist'
import prompts from 'prompts'
import { yellow, green, blue, red, cyan } from 'kolorist'

import { join, resolve, relative } from 'path'

import banner from './utils/banner'
import { postOrderDirectoryTraverse } from './utils/directoryTraverse'
import { deployVueTemplate } from './utils/deployVueTemplate'
import { deployTemplate } from './utils/deployTemplate'
import { generateLeanIXFiles } from './utils/leanix'

export type ColorFunc = (str: string | number) => string

export interface IFrameworkBase {
  name: string
  display: string
  color: ColorFunc
}

export interface IFrameworkVariant extends IFrameworkBase {
  customCommand?: string
}

export interface IFramework extends IFrameworkBase {
  variants?: IFrameworkVariant[]
}

export interface IProjectOptions {
  packageName?: string
  targetDir?: string
  overwrite?: boolean
  template?: string
}

export interface IVueFrameworkOptions {
  needsTypeScript?: boolean
  needsJsx?: boolean
  needsTailwindCSS?: boolean
  needsVitest?: boolean
  needsE2eTesting?: 'cypress' | 'playwright'
  needsEslint?: boolean
  needsPrettier?: boolean
}

export interface ILeanIXOptions {
  reportId?: string
  author?: string
  title?: string
  description?: string
  host?: string
  apitoken?: string
  proxyURL?: string
}

export interface IPromptResult extends IProjectOptions, IVueFrameworkOptions, ILeanIXOptions {
  projectName?: string
  framework?: IFramework
  variant?: string
}

const cwd = process.cwd()

const FRAMEWORKS: IFramework[] = [
  {
    name: 'vue',
    display: 'Vue',
    color: green
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
  }
]

const TEMPLATES = FRAMEWORKS
  .map(({ name, variants }) => Array.isArray(variants) ? variants.map(({ name }) => name) : [name])
  .flat()

const getLeanIXQuestions = (argv: minimist.ParsedArgs): Array<prompts.PromptObject<keyof ILeanIXOptions | 'behindProxy'>> => ([
  {
    type: argv?.reportId === undefined ? 'text' : null,
    name: 'reportId',
    message: 'Unique id for this report in Java package notation (e.g. net.leanix.barcharts)'
  },
  {
    type: argv?.author === undefined ? 'text' : null,
    name: 'author',
    message: 'Who is the author of this report (e.g. LeanIX GmbH)'
  },
  {
    type: argv?.title === undefined ? 'text' : null,
    name: 'title',
    message: 'A title to be shown in LeanIX when report is installed'
  },
  {
    type: argv?.description === undefined ? 'text' : null,
    name: 'description',
    message: 'Description of your project'
  },
  {
    type: argv?.host === undefined ? 'text' : null,
    name: 'host',
    initial: 'app.leanix.net',
    message: 'Which host do you want to work with?'
  },
  {
    type: argv?.apitoken === undefined ? 'text' : null,
    name: 'apitoken',
    message: 'API-Token for Authentication (see: https://dev.leanix.net/docs/authentication#section-generate-api-tokens)'
  },
  {
    type: argv?.proxyURL === undefined ? 'toggle' : null,
    name: 'behindProxy',
    message: 'Are you behind a proxy?',
    initial: false,
    active: 'Yes',
    inactive: 'No'
  },
  {
    type: (prev: boolean) => prev && 'text',
    name: 'proxyURL',
    message: 'Proxy URL?'
  }
])

const isVueFramework = (values: prompts.Answers<'framework'>): boolean => values?.framework?.name === 'vue'

const getVuePrompts = (): Array<prompts.PromptObject<keyof IVueFrameworkOptions | 'framework'>> => {
  return [
    {
      name: 'needsTypeScript',
      type: (_, values) => isVueFramework(values) ? 'toggle' : null,
      message: 'Add TypeScript?',
      initial: true,
      active: 'Yes',
      inactive: 'No'
    },
    {
      name: 'needsTailwindCSS',
      type: (_, values) => isVueFramework(values) ? 'toggle' : null,
      message: 'Add Tailwind CSS?',
      initial: true,
      active: 'Yes',
      inactive: 'No'
    },
    {
      name: 'needsJsx',
      type: (_, values) => isVueFramework(values) ? 'toggle' : null,
      message: 'Add JSX Support?',
      initial: false,
      active: 'Yes',
      inactive: 'No'
    },
    {
      name: 'needsVitest',
      type: (_, values) => isVueFramework(values) ? 'toggle' : null,
      message: 'Add Vitest for Unit Testing?',
      initial: true,
      active: 'Yes',
      inactive: 'No'
    },
    {
      name: 'needsE2eTesting',
      type: (_, values) => isVueFramework(values) ? 'select' : null,
      message: 'Add an End-to-End Testing Solution?',
      initial: 0,
      choices: (prev, answers) => [
        { title: 'No', value: false },
        {
          title: 'Cypress',
          description: (answers.needsVitest as boolean)
            ? undefined
            : 'also supports unit testing with Cypress Component Testing',
          value: 'cypress'
        },
        {
          title: 'Playwright',
          value: 'playwright'
        }
      ]
    },
    {
      name: 'needsEslint',
      type: (_, values) => isVueFramework(values) ? 'toggle' : null,
      message: 'Add ESLint for code quality?',
      initial: true,
      active: 'Yes',
      inactive: 'No'
    },
    {
      name: 'needsPrettier',
      type: (_, values) => (isVueFramework(values) && values.needsEslint as boolean) ? 'toggle' : null,
      message: 'Add Prettier for code formatting?',
      initial: true,
      active: 'Yes',
      inactive: 'No'
    }
  ]
}

async function init (): Promise<void> {
  console.log(`\n${banner}\n`)

  const argv = minimist(process.argv.slice(2), {
    string: ['template', 'reportId', 'author', 'title', 'description', 'host', 'apitoken', 'proxyUrl'],
    boolean: ['overwrite'],
    default: {
      overwrite: false
    }
  })

  let targetDir = argv?._?.[0] ?? null
  const defaultProjectName = targetDir ?? 'leanix-custom-report'

  const forceOverwrite = (argv.overwrite) ?? false as boolean
  const template = argv.template

  // leanix-specific answers
  let { reportId, author, title, description, host, apitoken, proxyURL } = argv

  let result: IPromptResult = {}

  try {
    result = await prompts(
      [
        {
          type: targetDir !== null ? null : 'text',
          name: 'projectName',
          message: 'Project name:',
          initial: defaultProjectName,
          onState: state => (targetDir = state.value.trim() ?? defaultProjectName)
        },
        {
          name: 'overwrite',
          type: () => (canSkipEmptying(targetDir) ?? forceOverwrite ? null : 'confirm'),
          message: () => {
            const dirForPrompt = targetDir === '.' ? 'Current directory' : `Target directory "${targetDir}"`
            return `${dirForPrompt} is not empty. Remove existing files and continue?`
          }
        },
        {
          name: 'overwriteChecker',
          type: (_, { overwrite }: { overwrite?: boolean }) => {
            if (overwrite === false) throw new Error(red('✖') + ' Operation cancelled')
            return null
          }
        },
        {
          name: 'packageName',
          type: () => (isValidPackageName(targetDir) ? null : 'text'),
          message: 'Package name:',
          initial: () => toValidPackageName(targetDir),
          validate: dir => isValidPackageName(dir) ?? 'Invalid package.json name'
        },
        {
          type: (template != null) && TEMPLATES.includes(template) ? null : 'select',
          name: 'framework',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? `"${template}" isn't a valid template. Please choose from below: `
              : 'Select a framework:',
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
          type: (framework: IFramework) => Array.isArray(framework?.variants) ? 'select' : null,
          name: 'variant',
          message: 'Select a variant:',
          choices: (framework: IFramework) => (framework?.variants ?? [])
            .map(variant => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.display ?? variant.name),
                value: variant.name
              }
            })
        },
        ...getVuePrompts(),
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
  const { overwrite } = result;
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

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent) ?? null
  const pkgManager = (pkgInfo != null) ? pkgInfo.name : 'npm'

  const root = join(cwd, targetDir ?? '')

  console.log(`\🚀Scaffolding project in ${root}...`)

  if (overwrite === true) emptyDir(root)
  else if (!fs.existsSync(root)) fs.mkdirSync(root)

  const deployFn = result?.framework?.name === 'vue' ? deployVueTemplate : deployTemplate
  deployFn({ defaultProjectName, targetDir: root, result })

  await generateLeanIXFiles({ targetDir: root, result })

  console.log('\n🔥Done. Now run:\n')
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
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
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
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

const canSkipEmptying = (dir: string): boolean => {
  if (!fs.existsSync(dir)) {
    return true
  }

  const files = fs.readdirSync(dir)
  if (files.length === 0) {
    return true
  }
  if (files.length === 1 && files[0] === '.git') {
    return true
  }

  return false
}

const emptyDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    return
  }

  postOrderDirectoryTraverse(
    dir,
    (dir: string) => fs.rmdirSync(dir),
    (file: string) => fs.unlinkSync(file)
  )
}

const pkgFromUserAgent = (userAgent?: string): { name: string, version: string } | undefined => {
  if (userAgent === undefined) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return { name: pkgSpecArr[0], version: pkgSpecArr[1] }
}

init().catch((e) => {
  console.error(e)
})
