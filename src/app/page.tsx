"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import type { CardDto, LookupError, LookupSuccess } from "@/lib/types";

function formatPrice(price: number | null): string {
  if (price == null || Number.isNaN(price)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function formatChange(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatUpdated(epochSeconds: number | null): string {
  if (!epochSeconds) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochSeconds * 1000));
}

function primaryVariant(card: CardDto, sku: string) {
  const exact = card.variants.find((v) => v.tcgplayerSkuId === sku);
  return exact ?? card.variants[0] ?? null;
}

export default function CounterPage() {
  const router = useRouter();
  const [skuInput, setSkuInput] = useState("");
  const [activeSku, setActiveSku] = useState<string | null>(null);
  const [card, setCard] = useState<CardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LookupError["code"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const labelVariant = useMemo(() => {
    if (!card || !activeSku) return null;
    return primaryVariant(card, activeSku);
  }, [card, activeSku]);

  async function lookup(sku: string) {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setCard(null);
    setActiveSku(sku);

    try {
      const response = await fetch(`/api/lookup?sku=${encodeURIComponent(sku)}`);
      const data = (await response.json()) as LookupSuccess & LookupError;

      if (!response.ok) {
        setError(data.error ?? "Lookup failed.");
        setErrorCode(data.code ?? null);
        return;
      }

      setCard(data.card);
      setActiveSku(data.sku);
    } catch {
      setError("Could not reach the lookup service.");
      setErrorCode("upstream");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sku = skuInput.trim();
    if (!sku) {
      setError("Enter a TCGplayer SKU to look up.");
      setErrorCode("bad_request");
      return;
    }
    void lookup(sku);
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function onPrint() {
    window.print();
  }

  return (
    <>
      <div className="app-shell no-print">
        <header className="app-header">
          <div>
            <p className="brand">SKU Counter</p>
            <h1>Card lookup</h1>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={onLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <main className="counter-main">
          <form className="sku-form" onSubmit={onSubmit}>
            <label htmlFor="sku">TCGplayer SKU</label>
            <div className="sku-row">
              <input
                id="sku"
                name="sku"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="Paste SKU from Toast"
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !skuInput.trim()}>
                {loading ? "Looking up…" : "Look up"}
              </button>
            </div>
          </form>

          {!loading && !card && !error ? (
            <p className="hint-state">
              Enter a SKU to pull JustTCG pricing and generate a printable barcode.
            </p>
          ) : null}

          {loading ? <p className="hint-state">Fetching live price data…</p> : null}

          {error ? (
            <div className="error-panel" role="alert">
              <p>{error}</p>
              {errorCode === "config" ? (
                <p className="error-detail">
                  Ask an admin to set <code>JUSTTCG_API_KEY</code> in the server environment.
                </p>
              ) : null}
              {errorCode === "not_found" ? (
                <p className="error-detail">
                  Double-check the SKU on Toast, or try the TCGplayer SKU barcode number again.
                </p>
              ) : null}
            </div>
          ) : null}

          {card && activeSku ? (
            <section className="result-panel" aria-live="polite">
              <div className="result-heading">
                <h2>{card.name}</h2>
                <p className="meta-line">
                  {[card.game, card.setName || card.set, card.number ? `#${card.number}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {card.rarity ? ` · ${card.rarity}` : ""}
                </p>
              </div>

              <dl className="id-grid">
                <div>
                  <dt>JustTCG ID</dt>
                  <dd>{card.id}</dd>
                </div>
                <div>
                  <dt>TCGplayer ID</dt>
                  <dd>{card.tcgplayerId ?? "—"}</dd>
                </div>
                <div>
                  <dt>SKU</dt>
                  <dd>{activeSku}</dd>
                </div>
              </dl>

              <div className="variants-block">
                <h3>Price variants</h3>
                {card.variants.length === 0 ? (
                  <p className="hint-state">No variant pricing returned for this card.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Condition</th>
                          <th>Printing</th>
                          <th>Price</th>
                          <th>24h</th>
                          <th>7d</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.variants.map((variant, index) => (
                          <tr
                            key={`${variant.condition}-${variant.printing}-${variant.tcgplayerSkuId ?? index}`}
                            className={
                              variant.tcgplayerSkuId === activeSku ? "sku-match" : undefined
                            }
                          >
                            <td>{variant.condition}</td>
                            <td>
                              {variant.printing}
                              {variant.language ? ` (${variant.language})` : ""}
                            </td>
                            <td>{formatPrice(variant.price)}</td>
                            <td>{formatChange(variant.priceChange24hr)}</td>
                            <td>{formatChange(variant.priceChange7d)}</td>
                            <td>{formatUpdated(variant.lastUpdated)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="barcode-block">
                <h3>Barcode label</h3>
                <div className="barcode-preview">
                  <BarcodeDisplay value={activeSku} className="barcode-svg" />
                  <p className="barcode-caption">
                    {card.name}
                    {labelVariant ? ` · ${formatPrice(labelVariant.price)}` : ""}
                  </p>
                </div>
                <button type="button" className="print-btn" onClick={onPrint}>
                  Print label
                </button>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      {card && activeSku ? (
        <div className="print-label" aria-hidden="true">
          <p className="print-name">{card.name}</p>
          <BarcodeDisplay value={activeSku} className="print-barcode" />
          <p className="print-meta">
            SKU {activeSku}
            {labelVariant ? ` · ${formatPrice(labelVariant.price)}` : ""}
            {labelVariant
              ? ` · ${labelVariant.condition} / ${labelVariant.printing}`
              : ""}
          </p>
        </div>
      ) : null}
    </>
  );
}
