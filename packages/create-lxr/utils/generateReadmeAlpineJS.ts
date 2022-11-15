import getCommand from './getCommand'

export interface IGenerateReadmeParams {
  projectName: string
  packageManager: string
  needsTypeScript?: boolean
}

export default function generateReadme (params: IGenerateReadmeParams): string {
  const commandFor = (scriptName: string, args?: string): string => getCommand(params.packageManager, scriptName, args)

  let readme = `# ${params.projectName}

This template should help get you started developing with Alpine JS in Vite.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

`

  const npmScriptsDescriptions = `\`\`\`sh
${commandFor('install')}
\`\`\`

### Compile and Hot-Reload for Development

\`\`\`sh
${commandFor('dev')}
\`\`\`

### ${(params.needsTypeScript ?? false) ? 'Type-Check, ' : ''}Compile and Minify for Production

\`\`\`sh
${commandFor('build')}
\`\`\`
`

  readme += npmScriptsDescriptions

  return readme
}
