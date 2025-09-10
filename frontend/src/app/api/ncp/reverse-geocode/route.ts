import { NextRequest, NextResponse } from 'next/server';

// Server-side only: NCP Maps API credentials
const NCP_KEY_ID = process.env.NCLOUD_MAPS_API_KEY_ID || process.env.NCP_MAPS_API_KEY_ID || '';
const NCP_KEY = process.env.NCLOUD_MAPS_API_KEY || process.env.NCP_MAPS_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 });
    }

    if (!NCP_KEY_ID || !NCP_KEY) {
      return NextResponse.json({ error: 'NCP credentials not configured' }, { status: 500 });
    }

    // NCP Maps Reverse Geocoding
    // docs: https://api.ncloud-docs.com/docs/application-maps-overview
    const endpoint = 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc';
    const url = `${endpoint}?request=coordsToaddr&sourcecrs=epsg:4326&coords=${encodeURIComponent(`${lng},${lat}`)}&output=json&orders=roadaddr,addr`;

    const res = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': NCP_KEY_ID,
        'x-ncp-apigw-api-key': NCP_KEY,
      },
      // avoid Next caching
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: 'NCP error', status: res.status, body: text }, { status: res.status });
    }

    const data = await res.json();

    // Best-effort address extraction
    let address = '';
    try {
      const results = data?.results || data?.v2?.results || [];
      for (const r of results) {
        if (r.name === 'roadaddr') {
          const parts: string[] = [];
          if (r.region?.area1?.name) parts.push(r.region.area1.name);
          if (r.region?.area2?.name) parts.push(r.region.area2.name);
          if (r.region?.area3?.name) parts.push(r.region.area3.name);
          if (r.region?.area4?.name) parts.push(r.region.area4.name);
          if (r.land?.name) parts.push(r.land.name);
          if (r.land?.number1) parts.push(r.land.number2 ? `${r.land.number1}-${r.land.number2}` : r.land.number1);
          address = parts.filter(Boolean).join(' ');
          if (address) break;
        }
      }
      if (!address && Array.isArray(results)) {
        for (const r of results) {
          if (r.name === 'addr') {
            const parts: string[] = [];
            if (r.region?.area1?.name) parts.push(r.region.area1.name);
            if (r.region?.area2?.name) parts.push(r.region.area2.name);
            if (r.region?.area3?.name) parts.push(r.region.area3.name);
            if (r.region?.area4?.name) parts.push(r.region.area4.name);
            if (r.land?.name) parts.push(r.land.name);
            if (r.land?.number1) parts.push(r.land.number2 ? `${r.land.number1}-${r.land.number2}` : r.land.number1);
            address = parts.filter(Boolean).join(' ');
            if (address) break;
          }
        }
      }
    } catch (_) {
      // ignore, fallback below
    }

    if (!address) {
      address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    return NextResponse.json({ address });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'unknown error' }, { status: 500 });
  }
}


