const { readdirSync, writeFileSync } = require('fs')
const { join } = require('path')
const packageJson = require('package-json')
const { gt, gtr, minVersion } = require('semver')
const { blue, green, bold, redBright } = require('chalk')
const log = console.log

  ; (async () => {
  const templateDir = join('..', 'templates')
  const templates = readdirSync(join(__dirname, templateDir))

  const currentLeanIXVitePluginVersion = require('../../vite-plugin-lxr/package.json').version

  for (const templateName of templates) {
    const pkgPath = join(__dirname, templateDir, templateName, 'package.json')
    const pkg = require(pkgPath)
    log(`${blue.bold('TEMPLATE')} ${bold(templateName)}:`)
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
        const gtVersion = gt(wanted, latest) ? wanted : latest

        if (gt(wanted, minVersion(requiredRange))) {
          pkg[key][dependency] = `^${wanted}`
          updates.push(`✔️  ${green.bold(dependency)}: ${requiredRange} to ^${wanted}`)
        }
        if (gtr(gtVersion, requiredRange)) {
          upgrades.push(`⚠️  upgrade-available for ${redBright.bold(dependency)}: ${requiredRange} to ^${gtVersion}`)
        }
      }
    }
    if (pkg.devDependencies['vite-plugin-lxr'] !== `^${currentLeanIXVitePluginVersion}`) {
      pkg.devDependencies['vite-plugin-lxr'] = currentLeanIXVitePluginVersion
      updates.push(`➕  Added ${green.bold('vite-plugin-lxr')} ^${currentLeanIXVitePluginVersion} to ${bold('devDependencies')}`)
    }
    if (updates.length > 0) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    const entries = [...updates, ...upgrades]
    if (entries.length > 0) entries.forEach(update => log(update))
    else log('😺 dependencies up to date!')
    log('')
  }
})()
