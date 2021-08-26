const fs = require('fs')
const path = require('path')

  ; (async () => {
  const templateDir = 'templates'
  const templates = fs
    .readdirSync(fs.join(__dirname, templateDir))
  for (const t of templates) {
    const pkgPath = path.join(__dirname, templateDir, t, 'package.json')
    const pkg = require(pkgPath)
    pkg.devDependencies['@fazendadosoftware/vite-plugin-leanix'] = '^' + require('../vite-plugin-leanix/package.json').version
    if (t.startsWith('vue')) {
      /*
      pkg.devDependencies['@vitejs/plugin-vue'] =
        '^' + require('../plugin-vue/package.json').version
        */
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  }
})()
