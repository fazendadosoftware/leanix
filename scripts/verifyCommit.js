// Invoked on the commit-msg git hook by yorkie.

const kleur = require('kleur')
const msgPath = process.env.GIT_PARAMS
const msg = require('fs').readFileSync(msgPath, 'utf-8').trim()

const releaseRE = /^v\d/
const commitRE =
  /^(revert: )?(feat|fix|docs|dx|refactor|perf|test|workflow|build|ci|chore|types|wip|release|deps)(\(.+\))?: .{1,50}/

if (!releaseRE.test(msg) && !commitRE.test(msg)) {
  console.log()
  console.error(
    `  ${kleur.bgRed.white(' ERROR ')} ${kleur.red(
      'invalid commit message format.'
    )}\n\n` +
    kleur.red(
      '  Proper commit message format is required for automated changelog generation. Examples:\n\n'
    ) +
    `    ${kleur.green('feat: add \'comments\' option')}\n` +
    `    ${kleur.green('fix: handle events on blur (close #28)')}\n\n` +
    kleur.red('  See .github/commit-convention.md for more details.\n')
  )
  process.exit(1)
}
