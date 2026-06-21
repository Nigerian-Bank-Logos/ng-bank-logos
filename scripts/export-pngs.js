import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const banks = JSON.parse(fs.readFileSync('./data/bank.json', 'utf8'))
const SIZE = 400
const VARIANTS = ['circle', 'square']
const REPO = 'https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main'

// Detects the red question-mark placeholder SVG by two structural signals that are
// identical across all known variants: the #DDDBDB circular border path and the
// #FF0000 question mark fill. Coordinates on the ? glyph vary between Figma exports
// so we do not match on those.
function isQuestionMarkPlaceholder(svgPath) {
  try {
    const content = fs.readFileSync(svgPath, 'utf8')
    return (
      content.includes('fill="#DDDBDB"') &&
      content.includes('fill="#FF0000"')
    )
  } catch {
    return false
  }
}

fs.mkdirSync('./dist', { recursive: true })

for (const [currency, data] of Object.entries(banks)) {
  const currencyFolder = currency.toLowerCase()
  const liveBanks = []

  // One deduplication set per variant, shared across all categories in this currency
  const usedFilenames = Object.fromEntries(VARIANTS.map(v => [v, new Set()]))

  for (const [categoryKey, categoryBanks] of Object.entries(data.categories)) {
    const categoryFolder = categoryKey.replace(/_/g, '-')

    for (const bank of categoryBanks) {
      const logos = {}
      let warnedForBank = false

      for (const variant of VARIANTS) {
        const outputDir = `./logos/${currencyFolder}/${variant}`
        fs.mkdirSync(outputDir, { recursive: true })

        const nameSvgPath = `./source/${currencyFolder}/${categoryFolder}/${variant}/${bank.name}.svg`
        const defaultSvg = `./source/_default/${variant}.svg`
        let sourceSvg = defaultSvg
        let matchedAlias = null

        if (fs.existsSync(nameSvgPath) && !isQuestionMarkPlaceholder(nameSvgPath)) {
          sourceSvg = nameSvgPath
        } else {
          for (const alias of (bank.aliases ?? [])) {
            const aliasSvgPath = `./source/${currencyFolder}/${categoryFolder}/${variant}/${alias}.svg`
            if (fs.existsSync(aliasSvgPath) && !isQuestionMarkPlaceholder(aliasSvgPath)) {
              sourceSvg = aliasSvgPath
              matchedAlias = alias
              break
            }
          }
        }

        // Warn once per bank, not once per variant
        if (!warnedForBank) {
          if (sourceSvg === defaultSvg) {
            console.warn(`⚠️  No SVG for "${bank.name}" in ${categoryFolder} — using default`)
            warnedForBank = true
          } else if (matchedAlias) {
            console.warn(`⚠️  "${bank.name}" matched via alias "${matchedAlias}"`)
            warnedForBank = true
          }
        }

        // Deduplicate output filename within this currency+variant folder
        let outputFilename = `${bank.name}.png`
        if (usedFilenames[variant].has(outputFilename)) {
          outputFilename = `${bank.name}-1.png`
        }
        usedFilenames[variant].add(outputFilename)

        const outputPath = path.join(outputDir, outputFilename)

        try {
          await sharp(sourceSvg)
            .resize(SIZE, SIZE)
            .png()
            .toFile(outputPath)
        } catch (err) {
          console.error(`❌ Failed to export "${bank.name}" (${variant}): ${err.message}`)
        }

        const encodedFilename = encodeURIComponent(outputFilename)
        logos[variant] = `${REPO}/logos/${currencyFolder}/${variant}/${encodedFilename}`
      }

      console.log(`✅ ${currency} — ${bank.name} (${bank.bankCode})`)

      liveBanks.push({
        name: bank.name,
        aliases: bank.aliases ?? [],
        bankCode: bank.bankCode,
        scCode: bank.scCode ?? null,
        category: categoryKey,
        logos
      })
    }
  }

  // Sort alphabetically by name
  liveBanks.sort((a, b) => a.name.localeCompare(b.name))

  const distPath = `./dist/banks_${currency}.json`
  fs.writeFileSync(distPath, JSON.stringify(liveBanks, null, 2))
  console.log(`\n📄 Generated ${distPath} with ${liveBanks.length} banks`)
}

console.log('\n🎉 Export complete')
