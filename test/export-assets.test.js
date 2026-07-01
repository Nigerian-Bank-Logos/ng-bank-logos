import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import {
  assetUrl,
  buildJsonDocument,
  categoryFolder,
  resolveSource,
} from '../scripts/lib/assets.js'
import { exportAssets } from '../scripts/lib/export.js'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#123456"/></svg>'

function fixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bank-assets-test-'))
  fs.mkdirSync(path.join(rootDir, 'data'), { recursive: true })
  fs.mkdirSync(
    path.join(rootDir, 'source', 'ngn', 'commercial-banks'),
    { recursive: true },
  )
  fs.writeFileSync(path.join(rootDir, 'source', '_default.svg'), SVG)
  return rootDir
}

function writeData(rootDir, banks) {
  fs.writeFileSync(
    path.join(rootDir, 'data', 'bank.json'),
    JSON.stringify({
      NGN: {
        metadata: {
          total_banks: banks.length,
          last_updated: '2026-06-23',
          country: 'Nigeria',
          sources: ['Test Source'],
          notes: 'Internal test note',
        },
        categories: { commercial_banks: banks },
      },
    }),
  )
}

test('category and URL helpers produce canonical encoded paths', () => {
  assert.equal(categoryFolder('commercial_banks'), 'commercial-banks')
  assert.equal(
    assetUrl({
      currency: 'NGN',
      category: 'commercial_banks',
      format: 'svg',
      filename: 'A & B.svg',
    }),
    'https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/svg/commercial-banks/A%20%26%20B.svg',
  )
})

test('JSON document versioning is deterministic and content-addressed', () => {
  const banks = [
    {
      name: 'Bank',
      aliases: [],
      bankCode: '1',
      scCode: null,
      category: 'commercial_banks',
      logos: {
        png: 'https://example.com/bank.png',
        svg: 'https://example.com/bank.svg',
      },
    },
  ]
  const document = buildJsonDocument({
    currency: 'NGN',
    metadata: {
      total_banks: 1,
      last_updated: '2020-01-01',
      country: 'Nigeria',
      sources: ['Source'],
      notes: 'Internal note',
    },
    banks,
    lastUpdated: '2026-06-23',
  })
  const sameDocument = buildJsonDocument({
    currency: 'NGN',
    metadata: {
      total_banks: 1,
      last_updated: '2026-06-23',
      country: 'Ghana',
      sources: ['Different source'],
      notes: 'Different internal note',
    },
    banks,
    lastUpdated: '2026-06-23',
  })
  const changedDocument = buildJsonDocument({
    currency: 'NGN',
    metadata: { total_banks: 1, last_updated: '2026-06-23' },
    banks: [{ ...banks[0], bankCode: '2' }],
    lastUpdated: '2026-06-23',
  })

  assert.equal(document.schemaVersion, '1.0.0')
  assert.deepEqual(document.metadata, {
    total_banks: 1,
    last_updated: '2026-06-23',
  })
  assert.match(document.dataVersion, /^sha256:[a-f0-9]{64}$/)
  assert.equal(document.dataVersion, sameDocument.dataVersion)
  assert.notEqual(document.dataVersion, changedDocument.dataVersion)
})

test('source resolution prefers canonical, then alias, then fallback', () => {
  const rootDir = fixture()
  const bank = { name: 'Canonical', aliases: ['Alias'] }
  const directory = path.join(rootDir, 'source', 'ngn', 'commercial-banks')
  fs.writeFileSync(path.join(directory, 'Alias.svg'), SVG)
  assert.equal(
    resolveSource({ rootDir, currency: 'NGN', category: 'commercial_banks', bank })
      .match,
    'alias',
  )
  fs.writeFileSync(path.join(directory, 'Canonical.svg'), SVG)
  assert.equal(
    resolveSource({ rootDir, currency: 'NGN', category: 'commercial_banks', bank })
      .match,
    'canonical',
  )
  fs.rmSync(path.join(directory, 'Canonical.svg'))
  fs.rmSync(path.join(directory, 'Alias.svg'))
  assert.equal(
    resolveSource({ rootDir, currency: 'NGN', category: 'commercial_banks', bank })
      .match,
    'fallback',
  )
})

test('export canonicalizes alias sources and removes stale outputs', async () => {
  const rootDir = fixture()
  writeData(rootDir, [
    { name: 'Canonical Bank', aliases: ['Old Bank'], bankCode: '1', scCode: null },
  ])
  fs.writeFileSync(
    path.join(rootDir, 'source', 'ngn', 'commercial-banks', 'Old Bank.svg'),
    SVG,
  )
  fs.mkdirSync(path.join(rootDir, 'logos'), { recursive: true })
  fs.writeFileSync(path.join(rootDir, 'logos', 'stale.png'), 'stale')

  await exportAssets({ rootDir, logger: { log() {}, warn() {} } })

  const pngPath = path.join(
    rootDir,
    'logos',
    'ngn',
    'png',
    'commercial-banks',
    'Canonical Bank.png',
  )
  const svgPath = path.join(
    rootDir,
    'logos',
    'ngn',
    'svg',
    'commercial-banks',
    'Canonical Bank.svg',
  )
  assert.equal(fs.existsSync(pngPath), true)
  assert.equal(fs.existsSync(svgPath), true)
  assert.equal(fs.existsSync(path.join(rootDir, 'logos', 'stale.png')), false)
  const metadata = await sharp(pngPath).metadata()
  assert.deepEqual([metadata.width, metadata.height], [400, 400])
})

test('fallback banks share the generated default asset URLs', async () => {
  const rootDir = fixture()
  writeData(rootDir, [
    { name: 'Missing Bank', aliases: [], bankCode: '2', scCode: null },
    { name: 'Another Missing Bank', aliases: [], bankCode: '3', scCode: null },
  ])
  const warnings = []
  await exportAssets({
    rootDir,
    logger: { log() {}, warn(message) { warnings.push(message) } },
  })
  assert.equal(warnings.length, 2)
  assert.equal(
    fs.existsSync(
      path.join(
        rootDir,
        'logos',
        '_default.svg',
      ),
    ),
    true,
  )
  assert.equal(
    fs.existsSync(
      path.join(
        rootDir,
        'logos',
        'ngn',
        'svg',
        'commercial-banks',
        'Missing Bank.svg',
      ),
    ),
    false,
  )
  const document = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'dist', 'banks_NGN.json'), 'utf8'),
  )
  assert.equal(document.schemaVersion, '1.0.0')
  assert.match(document.dataVersion, /^sha256:[a-f0-9]{64}$/)
  assert.equal(document.currency, 'NGN')
  assert.equal(document.metadata.total_banks, 2)
  assert.equal(document.metadata.last_updated, '2026-06-23')
  assert.equal('country' in document.metadata, false)
  assert.equal('sources' in document.metadata, false)
  assert.equal('notes' in document.metadata, false)
  const records = document.banks
  assert.deepEqual(records[0].logos, records[1].logos)
  assert.equal(
    records[0].logos.svg,
    'https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/_default.svg',
  )
})

test('render failure preserves existing published outputs', async () => {
  const rootDir = fixture()
  writeData(rootDir, [
    { name: 'Bank', aliases: [], bankCode: '3', scCode: null },
  ])
  fs.writeFileSync(
    path.join(rootDir, 'source', 'ngn', 'commercial-banks', 'Bank.svg'),
    SVG,
  )
  fs.mkdirSync(path.join(rootDir, 'logos'), { recursive: true })
  fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(rootDir, 'logos', 'existing.txt'), 'keep')
  fs.writeFileSync(path.join(rootDir, 'dist', 'existing.json'), 'keep')

  await assert.rejects(
    exportAssets({
      rootDir,
      logger: { log() {}, warn() {} },
      renderPng: async () => {
        throw new Error('forced failure')
      },
    }),
    /forced failure/,
  )
  assert.equal(fs.readFileSync(path.join(rootDir, 'logos', 'existing.txt'), 'utf8'), 'keep')
  assert.equal(fs.readFileSync(path.join(rootDir, 'dist', 'existing.json'), 'utf8'), 'keep')
})

test('malformed and externally linked SVGs fail before publication', async () => {
  for (const content of [
    '<svg><',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/logo.png"/></svg>',
  ]) {
    const rootDir = fixture()
    writeData(rootDir, [
      { name: 'Unsafe Bank', aliases: [], bankCode: '4', scCode: null },
    ])
    fs.writeFileSync(
      path.join(rootDir, 'source', 'ngn', 'commercial-banks', 'Unsafe Bank.svg'),
      content,
    )
    await assert.rejects(
      exportAssets({ rootDir, logger: { log() {}, warn() {} } }),
    )
    assert.equal(fs.existsSync(path.join(rootDir, 'logos')), false)
    assert.equal(fs.existsSync(path.join(rootDir, 'dist')), false)
  }
})
