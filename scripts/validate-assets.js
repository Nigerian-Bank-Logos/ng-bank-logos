import { loadBankData } from './lib/assets.js'
import { validateGenerated, validateSources } from './lib/validate.js'

const rootDir = process.cwd()
const sourceOnly = process.argv.includes('--source-only')

try {
  const bankData = loadBankData(rootDir)
  await validateSources(rootDir, bankData)
  if (!sourceOnly) await validateGenerated(rootDir, bankData)
  console.log(sourceOnly ? 'Source validation passed' : 'Validation passed')
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
