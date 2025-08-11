import { NextRequest, NextResponse } from 'next/server';

// Very simple in-memory cache (per server instance). For production, replace with Redis.
const CACHE = new Map<string, { address: string; expiresAt: number }>();
const DEFAULT_TTL_MS = 1000 * 60 * 10; // 10 minutes

function key(lat: string, lng: string) {
  // normalize to 4 decimal places
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const k = `${latNum.toFixed(4)},${lngNum.toFixed(4)}`;
  return k;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat,lng required' }, { status: 400 });
    }
    const k = key(lat, lng);
    const entry = CACHE.get(k);
    if (!entry) return NextResponse.json({ hit: false }, { status: 404 });
    if (Date.now() > entry.expiresAt) {
      CACHE.delete(k);
      return NextResponse.json({ hit: false }, { status: 404 });
    }
    return NextResponse.json({ hit: true, address: entry.address });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, address, ttlMs } = body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof address !== 'string') {
      return NextResponse.json({ error: 'lat:number, lng:number, address:string required' }, { status: 400 });
    }
    const k = key(String(lat), String(lng));
    const expiresAt = Date.now() + (typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS);
    CACHE.set(k, { address, expiresAt });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}


