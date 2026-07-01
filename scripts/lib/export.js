import fs from 'node:fs'
import path from 'node:path'
import {
  assetUrl,
  buildJsonDocument,
  categoryFolder,
  defaultAssetUrl,
  latestCatalogueUpdateDate,
  loadBankData,
  renderPng as defaultRenderPng,
  resolveSource,
  validateSvgSafety,
} from './assets.js'
import { validateGenerated, validateSources } from './validate.js'

function replaceDirectories(rootDir, stageRoot, names) {
  const token = `${process.pid}-${Date.now()}`
  const operations = names.map((name) => ({
    name,
    target: path.join(rootDir, name),
    staged: path.join(stageRoot, name),
    backup: path.join(rootDir, `.${name}.backup-${token}`),
    hadOriginal: false,
    installed: false,
  }))

  try {
    for (const operation of operations) {
      operation.hadOriginal = fs.existsSync(operation.target)
      if (operation.hadOriginal) {
        fs.renameSync(operation.target, operation.backup)
      }
      fs.renameSync(operation.staged, operation.target)
      operation.installed = true
    }
  } catch (error) {
    for (const operation of operations.reverse()) {
      if (operation.installed && fs.existsSync(operation.target)) {
        fs.rmSync(operation.target, { recursive: true, force: true })
      }
      if (operation.hadOriginal && fs.existsSync(operation.backup)) {
        fs.renameSync(operation.backup, operation.target)
      }
    }
    throw error
  }

  for (const operation of operations) {
    fs.rmSync(operation.backup, { recursive: true, force: true })
  }
}

export async function exportAssets({
  rootDir = process.cwd(),
  dryRun = false,
  logger = console,
  renderPng = defaultRenderPng,
} = {}) {
  const bankData = loadBankData(rootDir)
  await validateSources(rootDir, bankData)

  const stageRoot = fs.mkdtempSync(
    path.join(rootDir, `.export-stage-${process.pid}-`),
  )
  const logosRoot = path.join(stageRoot, 'logos')
  const distRoot = path.join(stageRoot, 'dist')

  try {
    fs.mkdirSync(logosRoot, { recursive: true })
    const defaultSource = path.join(rootDir, 'source', '_default.svg')
    const defaultContent = fs.readFileSync(defaultSource, 'utf8')
    validateSvgSafety(defaultContent, defaultSource)
    fs.writeFileSync(path.join(logosRoot, '_default.svg'), defaultContent)
    await renderPng(defaultSource, path.join(logosRoot, '_default.png'))

    for (const [currency, currencyData] of Object.entries(bankData)) {
      const records = []
      const lastUpdated = latestCatalogueUpdateDate(
        rootDir,
        currencyData.metadata.last_updated,
      )

      for (const [category, banks] of Object.entries(currencyData.categories)) {
        const folder = categoryFolder(category)
        const pngDirectory = path.join(
          logosRoot,
          currency.toLowerCase(),
          'png',
          folder,
        )
        const svgDirectory = path.join(
          logosRoot,
          currency.toLowerCase(),
          'svg',
          folder,
        )
        fs.mkdirSync(pngDirectory, { recursive: true })
        fs.mkdirSync(svgDirectory, { recursive: true })

        for (const bank of banks) {
          const resolved = resolveSource({
            rootDir,
            currency,
            category,
            bank,
          })
          if (resolved.match === 'alias') {
            logger.warn(
              `⚠️  "${bank.name}" matched via alias "${resolved.matchedAlias}"`,
            )
          } else if (resolved.match === 'fallback') {
            logger.warn(`⚠️  No SVG for "${bank.name}" — using default`)
          }

          const svgContent = fs.readFileSync(resolved.sourcePath, 'utf8')
          validateSvgSafety(svgContent, resolved.sourcePath)
          const svgFilename = `${bank.name}.svg`
          const pngFilename = `${bank.name}.png`
          if (resolved.match !== 'fallback') {
            fs.writeFileSync(path.join(svgDirectory, svgFilename), svgContent)
            await renderPng(
              resolved.sourcePath,
              path.join(pngDirectory, pngFilename),
            )
          }

          records.push({
            name: bank.name,
            aliases: bank.aliases ?? [],
            bankCode: bank.bankCode,
            scCode: bank.scCode ?? null,
            category,
            logos:
              resolved.match === 'fallback'
                ? {
                    png: defaultAssetUrl('png'),
                    svg: defaultAssetUrl('svg'),
                  }
                : {
                    png: assetUrl({
                      currency,
                      category,
                      format: 'png',
                      filename: pngFilename,
                    }),
                    svg: assetUrl({
                      currency,
                      category,
                      format: 'svg',
                      filename: svgFilename,
                    }),
                  },
          })
        }
      }

      records.sort((a, b) => a.name.localeCompare(b.name))
      fs.mkdirSync(distRoot, { recursive: true })
      fs.writeFileSync(
        path.join(distRoot, `banks_${currency}.json`),
        JSON.stringify(
          buildJsonDocument({
            currency,
            metadata: currencyData.metadata,
            banks: records,
            lastUpdated,
          }),
          null,
          2,
        ),
      )
      logger.log(`Generated ${records.length} ${currency} bank records`)
    }

    await validateGenerated(rootDir, bankData, { logosRoot, distRoot })
    if (!dryRun) replaceDirectories(rootDir, stageRoot, ['logos', 'dist'])
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true })
  }
}
