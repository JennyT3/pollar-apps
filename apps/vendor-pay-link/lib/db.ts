import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import type { StoreData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const TMP_PATH = path.join(DATA_DIR, "store.json.tmp");

const emptyStore = (): StoreData => ({
  vendors: {},
  charges: {},
  sales: {},
});

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Read the whole store. Auto-creates `data/store.json` on first use. */
export function readStore(): StoreData {
  ensureDir();
  if (!existsSync(STORE_PATH)) {
    const initial = emptyStore();
    writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      vendors: parsed.vendors ?? {},
      charges: parsed.charges ?? {},
      sales: parsed.sales ?? {},
    };
  } catch {
    return emptyStore();
  }
}

/** Atomic write so a crash mid-write does not corrupt the file. */
export function writeStore(data: StoreData): void {
  ensureDir();
  writeFileSync(TMP_PATH, JSON.stringify(data, null, 2), "utf8");
  renameSync(TMP_PATH, STORE_PATH);
}

/** Mutate-and-persist helper for route handlers. */
export function updateStore(mutator: (data: StoreData) => void): StoreData {
  const data = readStore();
  mutator(data);
  writeStore(data);
  return data;
}
