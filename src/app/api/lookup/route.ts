import { NextResponse } from "next/server";
import { JustTCG } from "justtcg-js";
import type { CardDto, LookupError } from "@/lib/types";

function jsonError(
  error: string,
  status: number,
  code?: LookupError["code"],
) {
  return NextResponse.json({ error, code } satisfies LookupError, { status });
}

export async function GET(request: Request) {
  const apiKey = process.env.JUSTTCG_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(
      "JUSTTCG_API_KEY is not configured. Add it to your environment and restart the server.",
      503,
      "config",
    );
  }

  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku")?.trim() ?? "";

  if (!sku) {
    return jsonError("Enter a TCGplayer SKU to look up.", 400, "bad_request");
  }

  try {
    const client = new JustTCG({ apiKey });
    const response = await client.v1.cards.get({ tcgplayerSkuId: sku });

    if (response.error) {
      const message =
        typeof response.error === "string"
          ? response.error
          : "JustTCG lookup failed.";
      return jsonError(message, 502, "upstream");
    }

    const cards = response.data ?? [];
    if (cards.length === 0) {
      return jsonError(
        `No card found for SKU ${sku}.`,
        404,
        "not_found",
      );
    }

    const card = cards[0];
    const dto: CardDto = {
      id: card.id,
      uuid: card.uuid,
      name: card.name,
      game: card.game,
      set: card.set,
      setName: card.set_name,
      number: card.number,
      rarity: card.rarity,
      tcgplayerId: card.tcgplayerId,
      variants: (card.variants ?? []).map((variant) => ({
        condition: variant.condition,
        printing: variant.printing,
        language: variant.language ?? null,
        tcgplayerSkuId: variant.tcgplayerSkuId,
        price: variant.price ?? null,
        lastUpdated: variant.lastUpdated ?? null,
        priceChange24hr: variant.priceChange24hr,
        priceChange7d: variant.priceChange7d,
      })),
    };

    return NextResponse.json({ sku, card });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error talking to JustTCG.";
    return jsonError(message, 502, "upstream");
  }
}
