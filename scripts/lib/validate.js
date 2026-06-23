import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {
  PNG_SIZE,
  assetUrl,
  categoryFolder,
  defaultAssetUrl,
  expectedBankCount,
  loadBankData,
  resolveSource,
  validateSvgSafety,
} from './assets.js'

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath]
  })
}

async function validateSvg(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  validateSvgSafety(content, filePath)
  const metadata = await sharp(filePath).metadata()
  if (metadata.format !== 'svg') {
    throw new Error(`${filePath} is not a valid SVG`)
  }
}

export async function validateSources(rootDir, bankData = loadBankData(rootDir)) {
  const defaultSvg = path.join(rootDir, 'source', '_default.svg')
  if (!fs.existsSync(defaultSvg)) throw new Error('Missing source/_default.svg')

  const sourceSvgs = walkFiles(path.join(rootDir, 'source')).filter((file) =>
    file.endsWith('.svg'),
  )
  for (const sourceSvg of sourceSvgs) await validateSvg(sourceSvg)

  for (const [currency, currencyData] of Object.entries(bankData)) {
    const actualCount = expectedBankCount(currencyData)
    if (currencyData.metadata.total_banks !== actualCount) {
      throw new Error(
        `${currency} metadata.total_banks is ${currencyData.metadata.total_banks}; expected ${actualCount}`,
      )
    }

    for (const [category, banks] of Object.entries(currencyData.categories)) {
      for (const bank of banks) {
        const resolved = resolveSource({
          rootDir,
          currency,
          category,
          bank,
        })
        if (!fs.existsSync(resolved.sourcePath)) {
          throw new Error(`No source or fallback SVG for ${bank.name}`)
        }
      }
    }
  }
}

export async function validateGenerated(
  rootDir,
  bankData = loadBankData(rootDir),
  { logosRoot = path.join(rootDir, 'logos'), distRoot = path.join(rootDir, 'dist') } = {},
) {
  const expectedFiles = new Set(['_default.png', '_default.svg'])
  const expectedDistFiles = new Set()
  const defaultPngPath = path.join(logosRoot, '_default.png')
  const defaultSvgPath = path.join(logosRoot, '_default.svg')

  if (!fs.existsSync(defaultPngPath)) throw new Error(`Missing ${defaultPngPath}`)
  if (!fs.existsSync(defaultSvgPath)) throw new Error(`Missing ${defaultSvgPath}`)
  const defaultPngMetadata = await sharp(defaultPngPath).metadata()
  if (
    defaultPngMetadata.format !== 'png' ||
    defaultPngMetadata.width !== PNG_SIZE ||
    defaultPngMetadata.height !== PNG_SIZE
  ) {
    throw new Error(`${defaultPngPath} must be a ${PNG_SIZE}x${PNG_SIZE} PNG`)
  }
  await validateSvg(defaultSvgPath)

  for (const [currency, currencyData] of Object.entries(bankData)) {
    const records = []
    for (const [category, banks] of Object.entries(currencyData.categories)) {
      const folder = categoryFolder(category)
      for (const bank of banks) {
        const resolved = resolveSource({
          rootDir,
          currency,
          category,
          bank,
        })
        const pngRelative = path.join(
          currency.toLowerCase(),
          'png',
          folder,
          `${bank.name}.png`,
        )
        const svgRelative = path.join(
          currency.toLowerCase(),
          'svg',
          folder,
          `${bank.name}.svg`,
        )
        if (resolved.match !== 'fallback') {
          expectedFiles.add(path.normalize(pngRelative))
          expectedFiles.add(path.normalize(svgRelative))

          const pngPath = path.join(logosRoot, pngRelative)
          const svgPath = path.join(logosRoot, svgRelative)
          if (!fs.existsSync(pngPath)) throw new Error(`Missing ${pngPath}`)
          if (!fs.existsSync(svgPath)) throw new Error(`Missing ${svgPath}`)

          const pngMetadata = await sharp(pngPath).metadata()
          if (
            pngMetadata.format !== 'png' ||
            pngMetadata.width !== PNG_SIZE ||
            pngMetadata.height !== PNG_SIZE
          ) {
            throw new Error(`${pngPath} must be a ${PNG_SIZE}x${PNG_SIZE} PNG`)
          }
          await validateSvg(svgPath)
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
                    filename: `${bank.name}.png`,
                  }),
                  svg: assetUrl({
                    currency,
                    category,
                    format: 'svg',
                    filename: `${bank.name}.svg`,
                  }),
                },
        })
      }
    }

    records.sort((a, b) => a.name.localeCompare(b.name))
    const distFilename = `banks_${currency}.json`
    expectedDistFiles.add(distFilename)
    const distPath = path.join(distRoot, distFilename)
    if (!fs.existsSync(distPath)) throw new Error(`Missing ${distPath}`)
    const generatedRecords = JSON.parse(fs.readFileSync(distPath, 'utf8'))
    if (JSON.stringify(generatedRecords) !== JSON.stringify(records)) {
      throw new Error(`${distPath} does not match the expected schema or data`)
    }
  }

  const actualFiles = walkFiles(logosRoot)
    .map((file) => path.normalize(path.relative(logosRoot, file)))
  const unexpected = actualFiles.filter((file) => !expectedFiles.has(file))
  if (unexpected.length) {
    throw new Error(`Unexpected generated assets:\n${unexpected.join('\n')}`)
  }
  if (actualFiles.length !== expectedFiles.size) {
    throw new Error(
      `Expected ${expectedFiles.size} generated assets; found ${actualFiles.length}`,
    )
  }

  const actualDistFiles = walkFiles(distRoot).map((file) =>
    path.normalize(path.relative(distRoot, file)),
  )
  const unexpectedDistFiles = actualDistFiles.filter(
    (file) => !expectedDistFiles.has(file),
  )
  if (
    unexpectedDistFiles.length ||
    actualDistFiles.length !== expectedDistFiles.size
  ) {
    throw new Error(
      `Unexpected generated data files:\n${unexpectedDistFiles.join('\n')}`,
    )
  }

  for (const currency of Object.keys(bankData)) {
    for (const oldVariant of ['circle', 'square']) {
      const oldDirectory = path.join(
        logosRoot,
        currency.toLowerCase(),
        oldVariant,
      )
      if (fs.existsSync(oldDirectory)) {
        throw new Error(`Obsolete ${oldDirectory} directory remains`)
      }
    }
  }
}
