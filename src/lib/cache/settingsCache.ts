import { prisma } from '@/lib/prisma';

interface CachedSettings {
  data: any;
  cachedAt: number;
}

let memoryCache: CachedSettings | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

/**
 * Fast in-memory cached lookup for HostelSettings.
 * If cached and fresh, returns immediately (<1ms).
 * Invalidate cache whenever settings are updated.
 */
export async function getCachedHostelSettings() {
  const now = Date.now();
  if (memoryCache && now - memoryCache.cachedAt < CACHE_TTL_MS) {
    return memoryCache.data;
  }

  let settings = await prisma.hostelSettings.findUnique({
    where: { id: 'default' },
  });

  if (!settings) {
    settings = await prisma.hostelSettings.create({
      data: {
        id: 'default',
        hostelName: 'SAIRAM ELITE LIVING',
      },
    });
  }

  memoryCache = {
    data: settings,
    cachedAt: now,
  };

  return settings;
}

/**
 * Invalidate the settings cache immediately upon admin update.
 */
export function invalidateHostelSettingsCache() {
  memoryCache = null;
}
