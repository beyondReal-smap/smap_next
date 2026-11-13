import { NextRequest, NextResponse } from 'next/server';
import { requireSignedMapAuth } from '@/lib/auth';

interface CacheEntry {
  address: string;
  timestamp: number;
  ttlMs: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_LIMIT = 1000;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ message: 'Invalid coordinates' }, { status: 400 });
  }

  const key = getCacheKey(lat, lng);
  const entry = cache.get(key);

  if (entry && (Date.now() - entry.timestamp < entry.ttlMs)) {
    return NextResponse.json({ address: entry.address });
  } else {
    // Cache miss or expired
    if (entry) {
      cache.delete(key); // Clean up expired entry
    }
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  const authError = requireSignedMapAuth(request);
  if (authError) return authError;
  try {
    const { lat, lng, address, ttlMs } = await request.json();

    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof address !== 'string') {
      return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }

    const key = getCacheKey(lat, lng);
    if (!cache.has(key) && cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, {
      address,
      timestamp: Date.now(),
      ttlMs: ttlMs || DEFAULT_TTL_MS,
    });

    return NextResponse.json({ message: 'Cached successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Error caching address', error: (error as Error).message }, { status: 500 });
  }
}