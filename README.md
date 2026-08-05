# SKU Counter

Internal counter tool for Toast barcodes: link each shop SKU to a JustTCG card once, then look up live prices and print barcode labels.

## Why mapping is required

Toast generates its own barcode/SKU numbers when an item is created. Those are **not** TCGplayer or JustTCG IDs. The app stores a local map:

`Toast SKU` → `JustTCG card / TCGplayer IDs`

After a barcode is linked, counter staff only need the Toast number.

## Features

- Shared shop password login (multiple people can use it at once)
- Card name search against JustTCG (approximate match)
- Optional Toast SKU for barcode printing and saving a link
- Card name, JustTCG ID, set/game, and variant pricing
- On-screen barcode of the Toast SKU with browser **Print label** support

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

3. Run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `SHOP_PASSWORD`.

## Counter workflow

1. Enter an approximate **card name** (required) and click **Search JustTCG**.
2. Pick the matching result (or a specific price variant).
3. Optionally enter a **Toast SKU** to print a barcode and/or **Save Toast link**.
4. Live prices come from JustTCG name search — Toast SKU is only for barcodes/linking.

Mappings (when saved) are stored in `data/sku-map.json` on the server.

## Deploy (Vercel)

File-based mappings work best on a long-lived host (VPS, always-on machine). On Vercel’s serverless filesystem, writes to `data/sku-map.json` do **not** persist reliably across invocations.

For Vercel production, plan to move the map to a small database (Turso, Postgres, or KV) later. Local / single-server deploy is fine for v1.

Set `JUSTTCG_API_KEY`, `SHOP_PASSWORD`, and `SESSION_SECRET` in the host environment.

## Notes

- The JustTCG API key never leaves the server.
- Until `JUSTTCG_API_KEY` is set, lookups/search return a clear configuration error.
- Printing uses the browser print dialog with a label-sized stylesheet (about 3.5" wide).
