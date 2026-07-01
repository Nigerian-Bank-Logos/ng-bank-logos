import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

export const CDN_ROOT =
  'https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main'
export const JSON_SCHEMA_VERSION = '1.0.0'
export const PNG_SIZE = 400
const PRIVATE_METADATA_FIELDS = new Set(['country', 'notes', 'sources'])

export function categoryFolder(category) {
  return category.replaceAll('_', '-')
}

export function isQuestionMarkPlaceholder(svgPath) {
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

export function validateSvgSafety(content, filePath = 'SVG') {
  const forbiddenMarkup =
    /<script\b|\son[a-z]+\s*=|javascript\s*:|<iframe\b|<object\b|<embed\b/i
  if (forbiddenMarkup.test(content)) {
    throw new Error(`${filePath} contains unsafe SVG content`)
  }

  const hrefPattern = /\b(?:href|xlink:href)\s*=\s*(['"])(.*?)\1/gi
  for (const match of content.matchAll(hrefPattern)) {
    const value = match[2].trim()
    if (!value.startsWith('#') && !value.startsWith('data:')) {
      throw new Error(`${filePath} contains an external SVG resource: ${value}`)
    }
  }
}

export function resolveSource({ rootDir, currency, category, bank }) {
  const folder = categoryFolder(category)
  const sourceDir = path.join(
    rootDir,
    'source',
    currency.toLowerCase(),
    folder,
  )
  const canonical = path.join(sourceDir, `${bank.name}.svg`)

  if (fs.existsSync(canonical) && !isQuestionMarkPlaceholder(canonical)) {
    return { sourcePath: canonical, match: 'canonical', matchedAlias: null }
  }

  for (const alias of bank.aliases ?? []) {
    const aliasPath = path.join(sourceDir, `${alias}.svg`)
    if (fs.existsSync(aliasPath) && !isQuestionMarkPlaceholder(aliasPath)) {
      return { sourcePath: aliasPath, match: 'alias', matchedAlias: alias }
    }
  }

  return {
    sourcePath: path.join(rootDir, 'source', '_default.svg'),
    match: 'fallback',
    matchedAlias: null,
  }
}

export function assetUrl({ currency, category, format, filename }) {
  return [
    CDN_ROOT,
    'logos',
    currency.toLowerCase(),
    format,
    categoryFolder(category),
    encodeURIComponent(filename),
  ].join('/')
}

export function defaultAssetUrl(format) {
  return `${CDN_ROOT}/logos/_default.${format}`
}

export async function renderPng(sourcePath, outputPath) {
  await sharp(sourcePath)
    .resize(PNG_SIZE, PNG_SIZE)
    .png()
    .toFile(outputPath)
}

export function loadBankData(rootDir) {
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, 'data', 'bank.json'), 'utf8'),
  )
}

export function expectedBankCount(currencyData) {
  return Object.values(currencyData.categories).reduce(
    (total, banks) => total + banks.length,
    0,
  )
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function dataVersionForDocument({
  schemaVersion = JSON_SCHEMA_VERSION,
  currency,
  metadata,
  banks,
}) {
  const content = stableStringify({
    schemaVersion,
    currency,
    metadata,
    banks,
  })
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`
}

export function publicMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !PRIVATE_METADATA_FIELDS.has(key)),
  )
}

export function buildJsonDocument({ currency, metadata, banks }) {
  const metadataForJson = publicMetadata(metadata)
  const documentWithoutDataVersion = {
    schemaVersion: JSON_SCHEMA_VERSION,
    currency,
    metadata: metadataForJson,
    banks,
  }
  return {
    schemaVersion: documentWithoutDataVersion.schemaVersion,
    dataVersion: dataVersionForDocument(documentWithoutDataVersion),
    currency,
    metadata: metadataForJson,
    banks,
  }
}
