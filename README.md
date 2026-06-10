# Nigerian Bank Icons

A free, open-source collection of Nigerian bank logos for use in web and mobile applications. Logos are available as PNGs via CDN and as a structured JSON file for easy backend integration.

---

## What's Included

- PNG logos for NGN banks
- `banks_NGN.json` — ready-to-use data files with logo URLs embedded
- Square and circle logo variants
- A default fallback logo for banks without a custom logo

---

## CDN Usage

Logos are served via jsDelivr directly from this GitHub repository. No setup required.

**URL pattern:**

```
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logo/{currency}/{variant}{bank-name}.png
```

**Examples:**

```
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/circle/Access%20Bank%20Nigeria.png
https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/square/Access%20Bank%20Nigeria.png
```

You can use these URLs directly in any `<img>` tag or `Image` component — no installation needed.

```html
<img
  src="https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/circle/Access%20Bank%20Nigeria.png"
  width="48"
/>
```

```jsx
<Image
  source={{
    uri: "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/circle/Access%20Bank%20Nigeria.png",
  }}
  style={{ width: 48, height: 48 }}
/>
```

---

## JSON Integration (Recommended)

The easiest way to use this library is via the pre-built JSON files. Each file contains a flat, alphabetically sorted list of banks with logo URLs already embedded.

### Fetch the JSON

```javascript
const response = await fetch(
  "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/dist/banks_NGN.json",
);
const banks = await response.json();
```

### JSON Structure

```json
[
  {
    "name": "Access Bank Nigeria",
    "aliases": ["Access Bank Nigeria"],
    "bankCode": "000014",
    "scCode": "044",
    "logo": "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/circle/Access%20Bank%20Nigeria.png"
  }
]
```

### Available JSON Files

| Currency      | URL                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------- |
| NGN (Nigeria) | `https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/dist/banks_NGN.json` |

---

## Backend Integration

The recommended approach is to enrich your bank list on the backend once, so every frontend — React, Flutter, Vue, or anything else — gets logo URLs without any extra work.

```javascript
// Node.js backend example
const paystack = await getPaystackBanks();
const { data: iconBanks } = await fetch(
  "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/dist/banks_NGN.json",
).then((r) => r.json());

const enriched = paystack.map((bank) => {
  const match = iconBanks.find((b) => b.scCode === bank.code);
  return {
    ...bank,
    logoSquare: match?.logoSquare ?? null,
    logoCircle: match?.logoCircle ?? null,
  };
});
```

Your API response now includes logo URLs. The frontend just renders them — no library or lookup needed.

---

## Frontend Integration

If you prefer to handle the logo lookup on the frontend:

```javascript
import banks from "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/dist/banks_NGN.json" assert { type: "json" };

function getLogo(bankCode, style = "square") {
  const bank = banks.find(
    (b) => b.scCode === bankCode || b.bankCode === bankCode,
  );
  return style === "circle" ? bank?.logoCircle : bank?.logoSquare;
}

// usage
const logoUrl = getLogo("044"); // returns square logo URL for Access Bank
```

---

## Logo Styles

Each bank logo is available in two styles:

| Style  | Description                | Use case                |
| ------ | -------------------------- | ----------------------- |
| Square | Original logo with padding | Cards, lists, dropdowns |
| Circle | Logo clipped to a circle   | Avatars, icon grids     |

---

## Supported Currencies

| Flag | Currency | Country |
| ---- | -------- | ------- |
| 🇳🇬   | NGN      | Nigeria |

More currencies coming soon.

---

## Contributing

Contributions are welcome. If a logo is missing, incorrect, or low quality, please open an issue or submit a pull request.

**To add or update a logo:**

1. Fork the repository
2. Add your SVG to `/source/{currency}/{variant}/Bank Name.svg`
3. Ensure the bank name exactly matches the `name` field in `data/banks.json`
4. Open a pull request

The GitHub Action will automatically export the PNG and update the JSON files once your PR is merged.

---

## Disclaimer

All bank logos are trademarks of their respective financial institutions. This library does not claim ownership of any logo. Logos are provided for developer convenience in building fintech applications. If you are a bank and would like your logo updated or removed, please open an issue.

---

## License

MIT — free to use in personal and commercial projects.
