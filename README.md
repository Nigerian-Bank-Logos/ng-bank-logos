# Nigerian Bank Logos

A free, open-source collection of Nigerian financial institution logos for web,
mobile, and backend applications. Every institution has a PNG and SVG asset,
plus a generated JSON record containing ready-to-use CDN URLs.

## What's included

- 400×400 PNG logos
- Original SVG logos
- Category-grouped asset paths
- Versioned `dist/banks_NGN.json`, with PNG and SVG URLs
- Shared default PNG and SVG fallbacks for institutions without a usable source logo

## CDN usage

Assets are served through jsDelivr:

```text
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/{currency}/{format}/{category}/{bank-name}.{format}
```

Examples:

```text
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/png/microfinance-banks/Kuda.png
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/svg/microfinance-banks/Kuda.svg
```

```html
<img
  src="https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/svg/microfinance-banks/Kuda.svg"
  alt="Kuda Bank"
  width="48"
  height="48"
  style="border-radius: 50%"
/>
```

Logos are no longer published as separate circle and square variants. Apply
`border-radius` or the equivalent styling in your application when a circular
presentation is needed.

## JSON integration

```javascript
const bankIndex = await fetch(
  "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/dist/banks_NGN.json",
).then((response) => response.json());

const banks = bankIndex.banks;
```

The JSON document has this structure:

```json
{
  "schemaVersion": "1.0.0",
  "dataVersion": "sha256:2c7d...",
  "currency": "NGN",
  "metadata": {
    "total_banks": 637,
    "last_updated": "2026-06-23",
    "country": "Nigeria"
  },
  "banks": [
    {
      "name": "Kuda",
      "aliases": [
        "Kuda MFB",
        "Kuda Microfinance Bank"
      ],
      "bankCode": "090267",
      "scCode": "50211",
      "category": "microfinance_banks",
      "logos": {
        "png": "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/png/microfinance-banks/Kuda.png",
        "svg": "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/svg/microfinance-banks/Kuda.svg"
      }
    }
  ]
}
```

`schemaVersion` identifies the JSON contract and changes only when the document
shape changes. `dataVersion` is generated automatically from the published
metadata and bank records, so it changes only when the generated data changes.

Example lookup:

```javascript
function getBankLogo(banks, code, format = "svg") {
  const bank = banks.find(
    (entry) => entry.bankCode === code || entry.scCode === code,
  );
  return bank?.logos[format] ?? null;
}

const logoUrl = getBankLogo(banks, "090267");
```

## Supported currencies

| Currency | Country |
| -------- | ------- |
| NGN      | Nigeria |

## Development

```bash
npm ci
npm test
npm run export
npm run validate
```

The exporter stages and validates every generated asset before replacing
`logos/` and `dist/`. A failed conversion leaves the existing published output
untouched.

Institutions without a source SVG share these fallback URLs:

```text
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/_default.png
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/_default.svg
```

## Contributing

To add or update a logo:

1. Add the institution to `data/bank.json` when necessary.
2. Add its SVG to `source/{currency}/{category}/Bank Name.svg`.
3. Make the filename match the record's `name` or one of its `aliases`.
4. Open a pull request.

Pull requests validate source safety and perform a complete dry-run export.
After changes reach `main`, GitHub Actions publishes the generated assets and
JSON.

## Disclaimer

All logos are trademarks of their respective financial institutions. This
repository does not claim ownership of them. If you represent an institution
and would like a logo updated or removed, please open an issue.

## License

MIT. See [LICENSE](LICENSE).
