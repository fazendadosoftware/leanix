#!/usr/bin/env node

// @ts-check
const { existsSync, mkdirSync, writeFileSync, readdirSync, lstatSync, rmdirSync, unlinkSync, statSync, copyFileSync } = require('fs')
const { join, resolve, relative } = require('path')
// Avoids autoconversion to number of the project name by defining that the args
// non associated with an option ( _ ) needs to be parsed as a string. See #4606
// const argv = require('minimist')(process.argv.slice(2), { string: ['_'] })

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const prompts = require('prompts')
const {
  yellow,
  green,
  blue,
  red
} = require('kolorist')

const { validateDocument } = require('@fazendadosoftware/leanix-core')

const cwd = process.cwd()

const FRAMEWORKS = [
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
  }
  /*
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
  */
]

const TEMPLATES = FRAMEWORKS.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), [])

const renameFiles = {
  _gitignore: '.gitignore'
}

const getLeanIXQuestions = ({ reportId, author, title, description, host, apitoken, proxyURL }) => ([
  {
    type: reportId === undefined ? 'text' : null,
    name: 'reportId',
    message: 'Unique id for this report in Java package notation (e.g. net.leanix.barcharts)'
  },
  {
    type: author === undefined ? 'text' : null,
    name: 'author',
    message: 'Who is the author of this report (e.g. LeanIX GmbH)'
  },
  {
    type: title === undefined ? 'text' : null,
    name: 'title',
    message: 'A title to be shown in LeanIX when report is installed'
  },
  {
    type: description === undefined ? 'text' : null,
    name: 'description',
    message: 'Description of your project'
  },
  {
    type: host === undefined ? 'text' : null,
    name: 'host',
    initial: 'app.leanix.net',
    message: 'Which host do you want to work with?'
  },
  {
    type: apitoken === undefined ? 'text' : null,
    name: 'apitoken',
    message: 'API-Token for Authentication (see: https://dev.leanix.net/docs/authentication#section-generate-api-tokens)'
  },
  {
    type: proxyURL === undefined ? 'confirm' : null,
    name: 'behindProxy',
    message: 'Are you behind a proxy?',
    initial: false
  },
  {
    type: prev => prev && 'text',
    name: 'proxyURL',
    message: 'Proxy URL?'
  }
])

async function init (argv) {
  let { targetDir = null, template = null } = argv
  // leanix-specific answers
  let { reportId, author, title, description, host, apitoken, proxyURL } = argv

  const defaultProjectName = targetDir ?? 'leanix-custom-report'

  let result = {}
  try {
    result = await prompts(
      [
        {
          type: targetDir ? null : 'text',
          name: 'projectName',
          message: 'Project name:',
          initial: defaultProjectName,
          onState: state => (targetDir = state.value.trim() || defaultProjectName)
        },
        {
          type: () => !existsSync(targetDir) || isEmpty(targetDir) ? null : 'confirm',
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? 'Current directory'
              : `Target directory "${targetDir}"`) +
            ' is not empty. Remove existing files and continue?'
        },
        {
          type: (_, { overwrite } = {}) => {
            if (overwrite === false) throw new Error(red('✖') + ' Operation cancelled')
            return null
          },
          name: 'overwriteChecker'
        },
        {
          type: () => (isValidPackageName(targetDir) ? null : 'text'),
          name: 'packageName',
          message: 'Package name:',
          initial: () => toValidPackageName(targetDir),
          validate: dir => isValidPackageName(dir) || 'Invalid package.json name'
        },
        {
          type: template && TEMPLATES.includes(template) ? null : 'select',
          name: 'framework',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? `"${template}" isn't a valid template. Please choose from below: `
              : 'Select a framework:',
          initial: 0,
          choices: FRAMEWORKS.map(framework => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.name),
              value: framework
            }
          })
        },
        {
          type: framework => framework && framework.variants ? 'select' : null,
          name: 'variant',
          message: 'Select a variant:',
          choices: framework => framework.variants
            .map(variant => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.name),
                value: variant.name
              }
            })
        },
        // @ts-ignore
        ...getLeanIXQuestions(argv)
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled')
        }
      }
    )
  } catch (cancelled) {
    console.log(cancelled.message)
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

  const root = join(cwd, targetDir)

  if (overwrite) emptyDir(root)
  else if (!existsSync(root)) mkdirSync(root)

  // determine template
  template = variant || framework || template

  console.log(`\nScaffolding project in ${root}...`)

  const templateDir = join(__dirname, 'templates', template)

  const write = (file, content) => {
    const targetPath = join(root, renameFiles[file] || file)
    content ? writeFileSync(targetPath, content) : copy(join(templateDir, file), targetPath)
  }

  readdirSync(templateDir).filter(f => f !== 'package.json').forEach(file => write(file))

  const pkg = require(join(templateDir, 'package.json'))

  const leanixReport = {
    id: reportId,
    author,
    title,
    description,
    defaultConfig: {}
  }

  validateDocument(leanixReport, 'lxreport.json')

  const reportName = packageName || targetDir
  pkg.name = reportName
  pkg.leanixReport = leanixReport

  const generatedFiles = {
    'package.json': { content: pkg },
    'lxr.json': { validateContent: true, content: { host, apitoken, proxyURL } }
  }

  Object.entries(generatedFiles)
    .forEach(([filename, { validateContent = false, content }]) => {
      // @ts-ignore
      if (validateContent === true) validateDocument(content, filename)
      write(filename, JSON.stringify(content, null, 2) + '\n')
    })

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'

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

function copy (src, dest) {
  const stat = statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    copyFileSync(src, dest)
  }
}

function isValidPackageName (projectName) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    projectName
  )
}

function toValidPackageName (projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
}

function copyDir (srcDir, destDir) {
  mkdirSync(destDir, { recursive: true })
  for (const file of readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

const isEmpty = path => readdirSync(path).length === 0

function emptyDir (dir) {
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
function pkgFromUserAgent (userAgent) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return { name: pkgSpecArr[0], version: pkgSpecArr[1] }
}

const getCliOptions = () => ({
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

// eslint-disable-next-line no-unused-expressions
yargs(hideBin(process.argv))
  .usage('Usage: $0 [targetDir] [options]')
  .command('* [targetDir] [options]', 'the default command', () => { }, argv => init(argv).catch(e => console.error(e)))
  .positional('targetDir', { describe: 'The folder in which the project will be created' })
  .options(getCliOptions())
  .argv
