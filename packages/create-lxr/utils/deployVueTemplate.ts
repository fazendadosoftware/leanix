import { join, resolve, basename, relative } from 'node:path'
import { existsSync, rmdirSync, unlinkSync, mkdirSync, writeFileSync, renameSync, readFileSync } from 'node:fs'
import { postOrderDirectoryTraverse, preOrderDirectoryTraverse } from './directoryTraverse'
import renderTemplate from './renderTemplate'
import renderEslint from './renderEslint'
import generateReadme from './generateReadme'
import { green, bold } from 'kolorist'
import getCommand from './getCommand'

import { IPromptResult } from '..'

const emptyDir = (dir: string): void => {
  if (!existsSync(dir)) return

  postOrderDirectoryTraverse(
    dir,
    (dir: string) => rmdirSync(dir),
    (file: string) => unlinkSync(file)
  )
}

export interface IDeployVueTemplateParams {
  targetDir: string
  defaultProjectName: string
  result: IPromptResult
}

export const deployVueTemplate = (params: IDeployVueTemplateParams): void => {
  const { targetDir, defaultProjectName, result } = params
  // `initial` won't take effect if the prompt type is null
  // so we still have to assign the default values here
  const {
    needsE2eTesting = false,
    needsVitest = false,
    overwrite = false,
    packageName,
    needsJsx = false,
    needsTypeScript = false,
    needsEslint = false,
    needsPrettier = false,
    projectName
  } = result
  const needsCypress = needsE2eTesting === 'cypress'
  const needsCypressCT = needsCypress && !needsVitest
  const needsPlaywright = needsE2eTesting === 'playwright'

  const root = join(process.cwd(), targetDir)

  if (existsSync(root) && (overwrite ?? false)) emptyDir(root)
  else if (!existsSync(root)) mkdirSync(root)

  console.log(`\nScaffolding project in ${root}...`)
  const pkg = { name: packageName, version: '0.0.0' }
  writeFileSync(resolve(root, 'package.json'), JSON.stringify(pkg, null, 2))

  // todo:
  // work around the esbuild issue that `import.meta.url` cannot be correctly transpiled
  // when bundling for node and the format is cjs
  // const templateRoot = new URL('./template', import.meta.url).pathname
  const templateRoot = resolve(__dirname, 'template')
  const render = (templateName: string): void => {
    const templateDir = resolve(templateRoot, templateName)
    renderTemplate(templateDir, root)
  }

  // Render base template
  render('base')
  // Add configs.
  if (needsJsx ?? false) render('config/jsx')
  if (needsVitest) render('config/vitest')
  if (needsCypress) render('config/cypress')
  if (needsCypressCT) render('config/cypress-ct')
  if (needsPlaywright) render('config/playwright')
  if (needsTypeScript ?? false) {
    render('config/typescript')
    // Render tsconfigs
    render('tsconfig/base')
    if (needsCypress) render('tsconfig/cypress')
    if (needsCypressCT) render('tsconfig/cypress-ct')
    if (needsVitest ?? false) render('tsconfig/vitest')
  }
  // Render ESLint config
  if (needsEslint) renderEslint(root, { needsTypeScript, needsCypress, needsCypressCT, needsPrettier })

  // Render code template.
  // prettier-ignore
  const codeTemplate = [needsTypeScript ? 'typescript-' : '', 'default'].join()
  render(`code/${codeTemplate}`)

  // Cleanup.

  // We try to share as many files between TypeScript and JavaScript as possible.
  // If that's not possible, we put `.ts` version alongside the `.js` one in the templates.
  // So after all the templates are rendered, we need to clean up the redundant files.
  // (Currently it's only `cypress/plugin/index.ts`, but we might add more in the future.)
  // (Or, we might completely get rid of the plugins folder as Cypress 10 supports `cypress.config.ts`)

  if (needsTypeScript) {
    // Convert the JavaScript template to the TypeScript
    // Check all the remaining `.js` files:
    //   - If the corresponding TypeScript version already exists, remove the `.js` version.
    //   - Otherwise, rename the `.js` file to `.ts`
    // Remove `jsconfig.json`, because we already have tsconfig.json
    // `jsconfig.json` is not reused, because we use solution-style `tsconfig`s, which are much more complicated.
    preOrderDirectoryTraverse(
      root,
      () => {},
      (filepath: string) => {
        if (filepath.endsWith('.js')) {
          const tsFilePath = filepath.replace(/\.js$/, '.ts')
          if (existsSync(tsFilePath)) unlinkSync(filepath)
          else renameSync(filepath, tsFilePath)
        } else if (basename(filepath) === 'jsconfig.json') unlinkSync(filepath)
      }
    )

    // Rename entry in `index.html`
    const indexHtmlPath = resolve(root, 'index.html')
    const indexHtmlContent = readFileSync(indexHtmlPath, 'utf8')
    writeFileSync(indexHtmlPath, indexHtmlContent.replace('src/main.js', 'src/main.ts'))
  } else {
    // Remove all the remaining `.ts` files
    preOrderDirectoryTraverse(
      root,
      () => {},
      (filepath: string) => {
        if (filepath.endsWith('.ts')) unlinkSync(filepath)
      }
    )
  }

  // Instructions:
  // Supported package managers: pnpm > yarn > npm
  const userAgent = process.env.npm_config_user_agent ?? ''
  const packageManager = 'pnpm'.includes(userAgent) ? 'pnpm' : 'yarn'.includes(userAgent) ? 'yarn' : 'npm'

  // README generation
  writeFileSync(
    resolve(root, 'README.md'),
    generateReadme({
      projectName: projectName ?? packageName ?? defaultProjectName,
      packageManager,
      needsTypeScript,
      needsVitest,
      needsCypress,
      needsPlaywright,
      needsCypressCT,
      needsEslint
    })
  )

  console.log('\nDone. Now run:\n')
  if (root !== process.cwd()) {
    console.log(`  ${bold(green(`cd ${relative(process.cwd(), root)}`))}`)
  }
  console.log(`  ${bold(green(getCommand(packageManager, 'install')))}`)
  if (needsPrettier) {
    console.log(`  ${bold(green(getCommand(packageManager, 'lint')))}`)
  }
  console.log(`  ${bold(green(getCommand(packageManager, 'dev')))}`)
  console.log()
}
