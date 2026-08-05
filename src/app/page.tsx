"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import type {
  CardDto,
  CardVariantDto,
  LookupError,
  SearchSuccess,
} from "@/lib/types";

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

function cardMeta(card: CardDto): string {
  return [
    card.game,
    card.setName || card.set,
    card.number ? `#${card.number}` : null,
    card.rarity,
  ]
    .filter(Boolean)
    .join(" · ");
}

function variantKey(variant: CardVariantDto, index: number): string {
  return `${variant.condition}|${variant.printing}|${variant.tcgplayerSkuId ?? index}`;
}

export default function CounterPage() {
  const router = useRouter();
  const barcodeSectionRef = useRef<HTMLElement | null>(null);

  const [cardName, setCardName] = useState("");
  const [toastSku, setToastSku] = useState("");
  const [searchResults, setSearchResults] = useState<CardDto[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardDto | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<CardVariantDto | null>(
    null,
  );
  const [mappingNote, setMappingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LookupError["code"] | null>(null);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const activeToastSku = toastSku.trim();

  const labelPrice = useMemo(
    () => formatPrice(selectedVariant?.price ?? null),
    [selectedVariant],
  );

  useEffect(() => {
    if (!selectedCard || !barcodeSectionRef.current) return;
    barcodeSectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedCard, selectedVariant]);

  function resetSelection() {
    setSelectedCard(null);
    setSelectedVariant(null);
    setMappingNote(null);
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = cardName.trim();
    if (!q) {
      setError("Enter a card name or number to search JustTCG.");
      setErrorCode("bad_request");
      return;
    }

    setSearching(true);
    setError(null);
    setErrorCode(null);
    setSearchResults([]);
    resetSelection();

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(q)}`,
      );
      const data = (await response.json()) as SearchSuccess & LookupError;

      if (!response.ok) {
        setError(data.error ?? "Search failed.");
        setErrorCode(data.code ?? null);
        return;
      }

      setSearchResults(data.cards);
      if (data.cards.length === 0) {
        setError("No JustTCG results. Try a shorter or different name.");
        setErrorCode("not_found");
      } else if (data.cards.length === 1) {
        selectCard(data.cards[0], data.cards[0].variants[0] ?? null);
      }
    } catch {
      setError("Could not reach JustTCG search.");
      setErrorCode("upstream");
    } finally {
      setSearching(false);
    }
  }

  function selectCard(card: CardDto, variant: CardVariantDto | null) {
    setSelectedCard(card);
    setSelectedVariant(variant ?? card.variants[0] ?? null);
    setMappingNote(null);
  }

  async function saveToastLink() {
    if (!selectedCard || !activeToastSku) return;

    setLinking(true);
    setMappingNote(null);

    try {
      const response = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toastSku: activeToastSku,
          cardName: selectedCard.name,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMappingNote(data.error ?? "Could not save Toast link.");
        return;
      }

      setMappingNote(
        `Saved pair only: Toast SKU ${activeToastSku} ↔ ${selectedCard.name} (no prices stored).`,
      );
    } catch {
      setMappingNote("Could not save Toast link.");
    } finally {
      setLinking(false);
    }
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
    if (!activeToastSku) return;
    window.print();
  }

  const selectedVariantKey = selectedVariant
    ? variantKey(selectedVariant, 0)
    : null;

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
          <form className="lookup-form" onSubmit={onSearch}>
            <div className="field">
              <label htmlFor="card-name">Card name / number</label>
              <input
                id="card-name"
                name="card-name"
                autoComplete="off"
                autoFocus
                placeholder="e.g. Charizard, ST29-001"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                disabled={searching}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="toast-sku">
                Toast SKU / barcode{" "}
                <span className="optional">(for print & save)</span>
              </label>
              <input
                id="toast-sku"
                name="toast-sku"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 413845783982"
                value={toastSku}
                onChange={(e) => setToastSku(e.target.value)}
                disabled={searching}
              />
            </div>

            <button
              type="submit"
              className="search-submit"
              disabled={searching || !cardName.trim()}
            >
              {searching ? "Searching…" : "Search JustTCG"}
            </button>
          </form>

          {!searching &&
          searchResults.length === 0 &&
          !error &&
          !selectedCard ? (
            <p className="hint-state">
              Search by name or collector number for live JustTCG prices. Select
              a card/price, then print a Toast barcode label. Only Toast SKU +
              card name are ever saved — never prices.
            </p>
          ) : null}

          {searching ? (
            <p className="hint-state">Searching JustTCG…</p>
          ) : null}

          {error ? (
            <div className="error-panel" role="alert">
              <p>{error}</p>
              {errorCode === "config" ? (
                <p className="error-detail">
                  Ask an admin to set <code>JUSTTCG_API_KEY</code> in the server
                  environment.
                </p>
              ) : null}
            </div>
          ) : null}

          {searchResults.length > 1 ||
          (searchResults.length === 1 && !selectedCard) ? (
            <section className="results-list" aria-live="polite">
              <h2>
                {searchResults.length} result
                {searchResults.length === 1 ? "" : "s"}
              </h2>
              <ul className="search-results">
                {searchResults.map((result) => {
                  const isSelected = selectedCard?.id === result.id;
                  return (
                    <li
                      key={result.id}
                      className={
                        isSelected
                          ? "search-result is-selected"
                          : "search-result"
                      }
                    >
                      <button
                        type="button"
                        className="result-select"
                        onClick={() =>
                          selectCard(result, result.variants[0] ?? null)
                        }
                      >
                        <strong>{result.name}</strong>
                        <span>{cardMeta(result)}</span>
                        <span className="search-ids">
                          JustTCG: {result.id}
                          {result.tcgplayerId
                            ? ` · TCGplayer: ${result.tcgplayerId}`
                            : ""}
                        </span>
                      </button>

                      {result.variants.length > 0 ? (
                        <div className="table-wrap variant-pick">
                          <table>
                            <thead>
                              <tr>
                                <th>Condition</th>
                                <th>Printing</th>
                                <th>Price</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {result.variants
                                .slice(0, 8)
                                .map((variant, index) => (
                                  <tr
                                    key={variantKey(variant, index)}
                                    className={
                                      isSelected &&
                                      selectedVariantKey ===
                                        variantKey(variant, index)
                                        ? "sku-match"
                                        : undefined
                                    }
                                  >
                                    <td>{variant.condition}</td>
                                    <td>
                                      {variant.printing}
                                      {variant.language
                                        ? ` (${variant.language})`
                                        : ""}
                                    </td>
                                    <td>{formatPrice(variant.price)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="link-variant-btn"
                                        onClick={() =>
                                          selectCard(result, variant)
                                        }
                                      >
                                        Select price
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {selectedCard ? (
            <section className="result-panel" aria-live="polite">
              <div className="result-heading">
                <h2>{selectedCard.name}</h2>
                <p className="meta-line">{cardMeta(selectedCard)}</p>
              </div>

              <dl className="id-grid">
                <div>
                  <dt>JustTCG ID</dt>
                  <dd>{selectedCard.id}</dd>
                </div>
                <div>
                  <dt>TCGplayer ID</dt>
                  <dd>{selectedCard.tcgplayerId ?? "—"}</dd>
                </div>
                <div>
                  <dt>Selected price</dt>
                  <dd>
                    {labelPrice}
                    {selectedVariant
                      ? ` · ${selectedVariant.condition} / ${selectedVariant.printing}`
                      : ""}
                  </dd>
                </div>
              </dl>

              <div className="variants-block">
                <h3>Price variants (live — not saved)</h3>
                {selectedCard.variants.length === 0 ? (
                  <p className="hint-state">
                    No variant pricing returned for this card.
                  </p>
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
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCard.variants.map((variant, index) => {
                          const key = variantKey(variant, index);
                          const isActive =
                            selectedVariantKey === key ||
                            (selectedVariant !== null &&
                              selectedVariant.condition === variant.condition &&
                              selectedVariant.printing === variant.printing &&
                              selectedVariant.tcgplayerSkuId ===
                                variant.tcgplayerSkuId);
                          return (
                            <tr
                              key={key}
                              className={isActive ? "sku-match" : undefined}
                            >
                              <td>{variant.condition}</td>
                              <td>
                                {variant.printing}
                                {variant.language
                                  ? ` (${variant.language})`
                                  : ""}
                              </td>
                              <td>{formatPrice(variant.price)}</td>
                              <td>{formatChange(variant.priceChange24hr)}</td>
                              <td>{formatChange(variant.priceChange7d)}</td>
                              <td>{formatUpdated(variant.lastUpdated)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="link-variant-btn"
                                  onClick={() =>
                                    selectCard(selectedCard, variant)
                                  }
                                >
                                  Use on label
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <section
                className="barcode-block"
                ref={barcodeSectionRef}
                id="barcode-label"
              >
                <h3>Barcode label</h3>
                <p className="meta-line">
                  Encodes the Toast SKU. Label shows the live selected price for
                  printing only — prices are never saved.
                </p>

                {!activeToastSku ? (
                  <div className="field barcode-sku-field">
                    <label htmlFor="toast-sku-barcode">
                      Enter Toast SKU to generate barcode
                    </label>
                    <input
                      id="toast-sku-barcode"
                      name="toast-sku-barcode"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="e.g. 413845783982"
                      value={toastSku}
                      onChange={(e) => setToastSku(e.target.value)}
                    />
                  </div>
                ) : null}

                {activeToastSku ? (
                  <>
                    <div className="barcode-preview">
                      <p className="barcode-card-name">{selectedCard.name}</p>
                      <p className="barcode-price-line">
                        {labelPrice}
                        {selectedVariant
                          ? ` · ${selectedVariant.condition} / ${selectedVariant.printing}`
                          : ""}
                      </p>
                      <BarcodeDisplay
                        value={activeToastSku}
                        className="barcode-svg"
                      />
                      <p className="barcode-caption">
                        Toast SKU {activeToastSku}
                      </p>
                    </div>
                    <div className="barcode-actions">
                      <button
                        type="button"
                        className="print-btn"
                        onClick={onPrint}
                      >
                        Print barcode label
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => void saveToastLink()}
                        disabled={linking}
                      >
                        {linking
                          ? "Saving…"
                          : "Save Toast SKU + card name"}
                      </button>
                    </div>
                    {mappingNote ? (
                      <p className="hint-state">{mappingNote}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="hint-state">
                    Add a Toast SKU above to display and print the barcode for
                    this selected card/price.
                  </p>
                )}
              </section>
            </section>
          ) : null}
        </main>
      </div>

      {selectedCard && activeToastSku ? (
        <div className="print-label" aria-hidden="true">
          <p className="print-name">{selectedCard.name}</p>
          <p className="print-price">{labelPrice}</p>
          {selectedVariant ? (
            <p className="print-variant">
              {selectedVariant.condition} / {selectedVariant.printing}
            </p>
          ) : null}
          <BarcodeDisplay value={activeToastSku} className="print-barcode" />
          <p className="print-meta">Toast SKU {activeToastSku}</p>
        </div>
      ) : null}
    </>
  );
}
