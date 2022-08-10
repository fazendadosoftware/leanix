import chalk from 'chalk'
import { readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import semver from 'semver'
import { fileURLToPath } from 'url'
import packageJson from 'package-json'
import vitePackageJson from 'vite-plugin-lxr/package.json' assert { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const currentLeanIXVitePluginVersion = vitePackageJson.version
const log = console.log

// force package upgrade, with eventual breaking changes
const FORCE_UPGRADE = true

  ; (async () => {
  const templateDir = join('..', 'templates')
  const templates = readdirSync(join(__dirname, templateDir))

  for (const templateName of templates) {
    const pkgPath = join(__dirname, templateDir, templateName, 'package.json')
    const { default: pkg } = await import(pkgPath, { assert: { type: 'json' } })
    log(`${chalk.blue.bold('TEMPLATE')} ${chalk.bold(templateName)}:`)
    const updates = []
    const upgrades = []

    const versionCache = {}

    for (const key of ['dependencies', 'devDependencies']) {
      for (const dependency in pkg[key] || {}) {
        const requiredRange = pkg[key][dependency]
        if (!versionCache[dependency]) {
          const [{ version: wanted }, { version: latest }] = await Promise.all([
            packageJson(dependency, { version: requiredRange }),
            packageJson(dependency)
          ])
          versionCache[dependency] = { wanted, latest }
        }
        const { wanted, latest } = versionCache[dependency]
        const gtVersion = semver.gt(wanted, latest) ? wanted : latest

        if (semver.gt(wanted, semver.minVersion(requiredRange))) {
          pkg[key][dependency] = `^${wanted}`
          updates.push(`✔️  ${chalk.green.bold(dependency)}: ${requiredRange} to ^${wanted}`)
        }
        if (semver.gtr(gtVersion, requiredRange)) {
          if (!FORCE_UPGRADE) upgrades.push(`⚠️  upgrade-available for ${chalk.redBright.bold(dependency)}: ${requiredRange} to ^${gtVersion}`)
          else {
            pkg[key][dependency] = `^${gtVersion}`
            upgrades.push(`⚠️  upgraded (may have breaking changes...) ${chalk.redBright.bold(dependency)}: ${requiredRange} to ^${gtVersion}`)
          }
        }
      }
    }
    if (pkg.devDependencies['vite-plugin-lxr'] !== `^${currentLeanIXVitePluginVersion}`) {
      pkg.devDependencies['vite-plugin-lxr'] = `^${currentLeanIXVitePluginVersion}`
      updates.push(`➕  Added ${chalk.green.bold('vite-plugin-lxr')} ^${currentLeanIXVitePluginVersion} to ${chalk.bold('devDependencies')}`)
    }
    if (updates.length > 0) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    const entries = [...updates, ...upgrades]
    if (entries.length > 0) entries.forEach(update => log(update))
    else log('😺 dependencies up to date!')
    log('')
  }
})()
