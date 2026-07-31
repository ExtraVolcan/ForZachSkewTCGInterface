export interface CardVariantDto {
  condition: string;
  printing: string;
  language: string | null;
  tcgplayerSkuId?: string;
  price: number | null;
  lastUpdated: number | null;
  priceChange24hr?: number | null;
  priceChange7d?: number | null;
}

export interface CardDto {
  id: string;
  uuid: string;
  name: string;
  game: string;
  set: string;
  setName?: string;
  number: string | null;
  rarity: string | null;
  tcgplayerId: string | null;
  variants: CardVariantDto[];
}

export interface LookupSuccess {
  sku: string;
  card: CardDto;
}

export interface LookupError {
  error: string;
  code?: "not_found" | "config" | "upstream" | "bad_request";
}
