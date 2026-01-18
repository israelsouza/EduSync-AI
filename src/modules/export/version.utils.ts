/**
 * Embedding Version Tracker
 *
 * Manages version control for embedding bundles to support delta sync.
 * Stores metadata about when embeddings were last updated.
 */

export interface EmbeddingVersion {
  version: string;
  createdAt: string;
  totalCount: number;
  modelName: string;
  tableName: string;
}

/**
 * Generate a semantic version string based on current timestamp
 * Format: YYYY.MM.DD.HHMMSS (e.g., "2026.01.18.143025")
 */
export function generateVersion(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}.${month}.${day}.${hours}${minutes}${seconds}`;
}

/**
 * Compare two version strings
 * @returns positive if v1 > v2, negative if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 !== p2) {
      return p1 - p2;
    }
  }

  return 0;
}
