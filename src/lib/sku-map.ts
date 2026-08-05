import { promises as fs } from "fs";
import path from "path";

export interface SkuMapping {
  toastSku: string;
  /** JustTCG card id (slug) */
  cardId: string;
  tcgplayerId: string | null;
  /** Specific variant SKU when linked to one condition/printing */
  tcgplayerSkuId: string | null;
  cardName: string;
  linkedAt: string;
}

interface SkuMapFile {
  mappings: Record<string, SkuMapping>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const MAP_PATH = path.join(DATA_DIR, "sku-map.json");

let writeQueue: Promise<void> = Promise.resolve();

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
    const parsed = JSON.parse(raw) as SkuMapFile;
    return { mappings: parsed.mappings ?? {} };
  } catch {
    return { mappings: {} };
  }
}

async function writeMap(data: SkuMapFile): Promise<void> {
  await ensureStore();
  const tmp = `${MAP_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
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
    ...mapping,
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
