import { NextResponse } from "next/server";
import { getJustTcgClient, toCardDto } from "@/lib/justtcg";
import { getMapping } from "@/lib/sku-map";
import type { LookupError, LookupSuccess, SkuMappingDto } from "@/lib/types";

function jsonError(
  error: string,
  status: number,
  code?: LookupError["code"],
) {
  return NextResponse.json({ error, code } satisfies LookupError, { status });
}

function toMappingDto(mapping: {
  toastSku: string;
  cardId: string;
  tcgplayerId: string | null;
  tcgplayerSkuId: string | null;
  cardName: string;
  linkedAt: string;
}): SkuMappingDto {
  return {
    toastSku: mapping.toastSku,
    cardId: mapping.cardId,
    tcgplayerId: mapping.tcgplayerId,
    tcgplayerSkuId: mapping.tcgplayerSkuId,
    cardName: mapping.cardName,
    linkedAt: mapping.linkedAt,
  };
}

export async function GET(request: Request) {
  const client = getJustTcgClient();
  if (!client) {
    return jsonError(
      "JUSTTCG_API_KEY is not configured. Add it to your environment and restart the server.",
      503,
      "config",
    );
  }

  const { searchParams } = new URL(request.url);
  const toastSku = (searchParams.get("sku") ?? searchParams.get("toastSku") ?? "")
    .trim();

  if (!toastSku) {
    return jsonError("Enter a Toast SKU to look up.", 400, "bad_request");
  }

  const mapping = await getMapping(toastSku);
  if (!mapping) {
    return jsonError(
      `No JustTCG link for Toast SKU ${toastSku}. Search for the card and link it once.`,
      404,
      "unmapped",
    );
  }

  try {
    const params = mapping.tcgplayerSkuId
      ? { tcgplayerSkuId: mapping.tcgplayerSkuId }
      : mapping.tcgplayerId
        ? { tcgplayerId: mapping.tcgplayerId }
        : { cardId: mapping.cardId };

    const response = await client.v1.cards.get(params);

    if (response.error) {
      return jsonError(response.error, 502, "upstream");
    }

    const cards = response.data ?? [];
    if (cards.length === 0) {
      return jsonError(
        `Mapped card not found in JustTCG for Toast SKU ${toastSku}. Try re-linking it.`,
        404,
        "not_found",
      );
    }

    const payload: LookupSuccess = {
      toastSku,
      sku: toastSku,
      mapping: toMappingDto(mapping),
      card: toCardDto(cards[0]),
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error talking to JustTCG.";
    return jsonError(message, 502, "upstream");
  }
}
