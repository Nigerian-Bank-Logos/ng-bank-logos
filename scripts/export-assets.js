import { exportAssets } from './lib/export.js'

const dryRun = process.argv.includes('--dry-run')

try {
  await exportAssets({ dryRun })
  console.log(dryRun ? 'Export dry run passed' : 'Export complete')
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
