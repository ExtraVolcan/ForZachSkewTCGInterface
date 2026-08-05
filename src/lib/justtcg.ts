import { JustTCG, type Card } from "justtcg-js";
import type { CardDto } from "@/lib/types";

export function getJustTcgClient(): JustTCG | null {
  const apiKey = process.env.JUSTTCG_API_KEY?.trim();
  if (!apiKey) return null;
  return new JustTCG({ apiKey });
}

export function toCardDto(card: Card): CardDto {
  return {
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
}
