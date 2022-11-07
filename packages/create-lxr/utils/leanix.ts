import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateDocument } from 'lxr-core'
import { IPromptResult } from '..'
import { pathToFileURL } from 'node:url'

export interface IAddLeanIXMetadataToPackageJson {
  targetDir: string
  result: IPromptResult
}

export interface IGenerateLeanIXFilesOutput {
  packageJson: any
  lxrJson: any
}

export const generateLeanIXFiles = async (params: IAddLeanIXMetadataToPackageJson): Promise<void> => {
  const { targetDir, result } = params
  const { author, description, reportId, title, host, apitoken, proxyURL, packageName } = result
  let pkg = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8'))
  const name = packageName ?? pkg.name ?? pathToFileURL(targetDir ?? '').pathname.split('/').at(-1)
  const version = pkg.version ?? '0.0.0'
  const pkgMetadataFields = { name, author, description, version }
  const leanixReport = { id: reportId, title, defaultConfig: {} }
  pkg = { ...pkg, ...pkgMetadataFields, leanixReport }
  const lxreportJson = { ...leanixReport, ...pkgMetadataFields }
  await validateDocument(lxreportJson, 'lxreport.json')
  const lxrJson = { host, apitoken, proxyURL }

  await validateDocument(lxrJson, 'lxr.json')
  await writeFile(join(targetDir, 'lxr.json'), JSON.stringify(lxrJson, null, 2))
  await writeFile(join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2))
}
