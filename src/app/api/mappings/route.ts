import { NextResponse } from "next/server";
import { deleteMapping, listMappings, upsertMapping } from "@/lib/sku-map";
import type { LookupError, SkuMappingDto } from "@/lib/types";

function jsonError(
  error: string,
  status: number,
  code?: LookupError["code"],
) {
  return NextResponse.json({ error, code } satisfies LookupError, { status });
}

export async function GET() {
  const mappings = await listMappings();
  return NextResponse.json({ mappings });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      toastSku?: string;
      cardName?: string;
    };

    const toastSku = body.toastSku?.trim() ?? "";
    const cardName = body.cardName?.trim() ?? "";

    if (!toastSku || !cardName) {
      return jsonError(
        "Only toastSku and cardName can be saved.",
        400,
        "bad_request",
      );
    }

    const mapping = await upsertMapping({ toastSku, cardName });
    const dto: SkuMappingDto = {
      toastSku: mapping.toastSku,
      cardName: mapping.cardName,
      linkedAt: mapping.linkedAt,
    };

    return NextResponse.json({ mapping: dto });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save mapping.";
    return jsonError(message, 500);
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const toastSku = searchParams.get("toastSku")?.trim() ?? "";

  if (!toastSku) {
    return jsonError("toastSku is required.", 400, "bad_request");
  }

  const removed = await deleteMapping(toastSku);
  if (!removed) {
    return jsonError(`No mapping found for ${toastSku}.`, 404, "not_found");
  }

  return NextResponse.json({ ok: true });
}
