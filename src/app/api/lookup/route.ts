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
      `No saved card name for Toast SKU ${toastSku}.`,
      404,
      "unmapped",
    );
  }

  try {
    // Live fetch only — prices are never read from disk.
    const response = await client.v1.cards.search(mapping.cardName, {
      limit: 20,
    });

    if (response.error) {
      return jsonError(response.error, 502, "upstream");
    }

    const cards = response.data ?? [];
    if (cards.length === 0) {
      return jsonError(
        `No live JustTCG results for saved name "${mapping.cardName}".`,
        404,
        "not_found",
      );
    }

    const mappingDto: SkuMappingDto = {
      toastSku: mapping.toastSku,
      cardName: mapping.cardName,
      linkedAt: mapping.linkedAt,
    };

    const payload: LookupSuccess = {
      toastSku,
      sku: toastSku,
      mapping: mappingDto,
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
