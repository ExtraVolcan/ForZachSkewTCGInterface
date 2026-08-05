import { NextResponse } from "next/server";
import type { Card } from "justtcg-js";
import { getJustTcgClient, toCardDto } from "@/lib/justtcg";
import type { CardDto, LookupError, SearchSuccess } from "@/lib/types";

function jsonError(
  error: string,
  status: number,
  code?: LookupError["code"],
) {
  return NextResponse.json({ error, code } satisfies LookupError, { status });
}

/** Collector numbers like ST29-001, OP05-001, 15, 015a */
function looksLikeCardNumber(query: string): boolean {
  return /^[A-Za-z0-9]+-\d+[A-Za-z]?$/i.test(query) || /^\d{1,4}[A-Za-z]?$/i.test(query);
}

/** JustTCG slug ids are usually long kebab-case */
function looksLikeCardId(query: string): boolean {
  return query.includes("-") && query.length > 12 && /[a-z]/i.test(query) && !looksLikeCardNumber(query);
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function rankCard(card: CardDto, query: string): number {
  const q = normalize(query);
  const number = normalize(card.number);
  const id = normalize(card.id);
  const name = normalize(card.name);

  if (number === q || id === q) return 0;
  if (number.startsWith(q) || id.includes(q)) return 1;
  if (name === q) return 2;
  if (name.startsWith(q)) return 3;
  if (name.includes(q)) return 4;
  return 5;
}

function mergeCards(groups: Card[][]): CardDto[] {
  const byId = new Map<string, CardDto>();
  for (const group of groups) {
    for (const card of group) {
      if (!byId.has(card.id)) {
        byId.set(card.id, toCardDto(card));
      }
    }
  }
  return Array.from(byId.values());
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
  const query = searchParams.get("q")?.trim() ?? "";
  const game = searchParams.get("game")?.trim() || undefined;

  if (!query) {
    return jsonError("Enter a card name or card number to search.", 400, "bad_request");
  }

  try {
    const lookups: Promise<{ data?: Card[]; error?: string }>[] = [
      client.v1.cards.search(query, { game, limit: 20 }),
    ];

    if (looksLikeCardNumber(query)) {
      lookups.push(
        client.v1.cards.get({
          number: query,
          game,
          limit: 20,
        }),
      );
    }

    if (looksLikeCardId(query)) {
      lookups.push(
        client.v1.cards.get({
          cardId: query,
          game,
          limit: 20,
        }),
      );
    }

    const responses = await Promise.all(lookups);
    const upstreamError = responses.find((r) => r.error)?.error;
    const cards = mergeCards(responses.map((r) => r.data ?? []));

    if (cards.length === 0 && upstreamError) {
      return jsonError(upstreamError, 502, "upstream");
    }

    cards.sort((a, b) => {
      const rankDiff = rankCard(a, query) - rankCard(b, query);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });

    const payload: SearchSuccess = {
      query,
      cards: cards.slice(0, 20),
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
