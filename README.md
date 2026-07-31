# SKU Counter

Internal counter tool for looking up TCGplayer SKUs via [JustTCG](https://justtcg.com), viewing live price data, and printing barcode labels.

## Features

- Shared shop password login (multiple people can use it at once)
- SKU lookup against JustTCG (`tcgplayerSkuId`)
- Card name, JustTCG ID, set/game, and variant pricing
- On-screen barcode with browser **Print label** support

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env example and fill in values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Purpose |
|----------|---------|
| `JUSTTCG_API_KEY` | API key from [justtcg.com](https://justtcg.com) |
| `SHOP_PASSWORD` | Shared password for counter staff |
| `SESSION_SECRET` | Random string, **at least 32 characters**, used to encrypt the session cookie |

Example:

```env
JUSTTCG_API_KEY=tcg_your_key_here
SHOP_PASSWORD=your-shop-password
SESSION_SECRET=replace-with-a-long-random-secret-at-least-32-chars
```

3. Run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `SHOP_PASSWORD`, enter a TCGplayer SKU from Toast, then use **Print label**.

## Deploy (Vercel)

1. Push this repo and import the project in Vercel.
2. Set `JUSTTCG_API_KEY`, `SHOP_PASSWORD`, and `SESSION_SECRET` in the Vercel project environment variables.
3. Deploy. Staff open the site URL, log in, and look up SKUs.

## Usage at the counter

1. Sign in with the shared shop password.
2. Paste or type the SKU from Toast.
3. Review card info and live prices.
4. Click **Print label** (or use the browser print dialog) to print the barcode.

## Notes

- The JustTCG API key never leaves the server.
- Until `JUSTTCG_API_KEY` is set, lookups return a clear configuration error.
- Printing uses the browser print dialog with a label-sized stylesheet (about 3.5" wide). Choose your label printer in the print dialog.
