import { promises as fs } from "fs";
import path from "path";

/**
 * Only Toast SKU + card name are persisted.
 * JustTCG prices and API identifiers are never stored.
 */
export interface SkuMapping {
  toastSku: string;
  cardName: string;
  linkedAt: string;
}

interface SkuMapFile {
  mappings: Record<string, SkuMapping>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const MAP_PATH = path.join(DATA_DIR, "sku-map.json");

let writeQueue: Promise<void> = Promise.resolve();

function sanitizeMapping(raw: unknown): SkuMapping | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const toastSku =
    typeof record.toastSku === "string" ? record.toastSku.trim() : "";
  const cardName =
    typeof record.cardName === "string" ? record.cardName.trim() : "";
  if (!toastSku || !cardName) return null;

  return {
    toastSku,
    cardName,
    linkedAt:
      typeof record.linkedAt === "string" && record.linkedAt
        ? record.linkedAt
        : new Date().toISOString(),
  };
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(MAP_PATH);
  } catch {
    const empty: SkuMapFile = { mappings: {} };
    await fs.writeFile(MAP_PATH, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readMap(): Promise<SkuMapFile> {
  await ensureStore();
  const raw = await fs.readFile(MAP_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as { mappings?: Record<string, unknown> };
    const mappings: Record<string, SkuMapping> = {};
    for (const [key, value] of Object.entries(parsed.mappings ?? {})) {
      const cleaned = sanitizeMapping(value);
      if (cleaned) {
        mappings[key] = cleaned;
      }
    }
    return { mappings };
  } catch {
    return { mappings: {} };
  }
}

async function writeMap(data: SkuMapFile): Promise<void> {
  await ensureStore();
  // Strip anything except toastSku + cardName (+ linkedAt metadata).
  const cleaned: SkuMapFile = { mappings: {} };
  for (const [key, value] of Object.entries(data.mappings)) {
    const mapping = sanitizeMapping(value);
    if (mapping) cleaned.mappings[key] = mapping;
  }
  const tmp = `${MAP_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(cleaned, null, 2), "utf8");
  await fs.rename(tmp, MAP_PATH);
}

export async function getMapping(toastSku: string): Promise<SkuMapping | null> {
  const data = await readMap();
  return data.mappings[toastSku] ?? null;
}

export async function listMappings(): Promise<SkuMapping[]> {
  const data = await readMap();
  return Object.values(data.mappings).sort((a, b) =>
    a.toastSku.localeCompare(b.toastSku),
  );
}

export async function upsertMapping(
  mapping: Omit<SkuMapping, "linkedAt"> & { linkedAt?: string },
): Promise<SkuMapping> {
  const saved: SkuMapping = {
    toastSku: mapping.toastSku.trim(),
    cardName: mapping.cardName.trim(),
    linkedAt: mapping.linkedAt ?? new Date().toISOString(),
  };

  writeQueue = writeQueue.then(async () => {
    const data = await readMap();
    data.mappings[saved.toastSku] = saved;
    await writeMap(data);
  });

  await writeQueue;
  return saved;
}

export async function deleteMapping(toastSku: string): Promise<boolean> {
  let removed = false;

  writeQueue = writeQueue.then(async () => {
    const data = await readMap();
    if (data.mappings[toastSku]) {
      delete data.mappings[toastSku];
      removed = true;
      await writeMap(data);
    }
  });

  await writeQueue;
  return removed;
}
