import { NextRequest, NextResponse } from 'next/server';

const NCP_KEY_ID = process.env.NCLOUD_MAPS_API_KEY_ID || process.env.NCP_MAPS_API_KEY_ID || '';
const NCP_KEY = process.env.NCLOUD_MAPS_API_KEY || process.env.NCP_MAPS_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    if (!query) {
      return NextResponse.json({ error: 'query required' }, { status: 400 });
    }

    if (!NCP_KEY_ID || !NCP_KEY) {
      return NextResponse.json({ error: 'NCP credentials not configured' }, { status: 500 });
    }

    const endpoint = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
    const url = `${endpoint}?query=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': NCP_KEY_ID,
        'x-ncp-apigw-api-key': NCP_KEY,
      },
      cache: 'no-store',
    });

    const text = await res.text();
    if (!res.ok) {
      return new NextResponse(text || 'NCP error', { status: res.status });
    }

    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'unknown error' }, { status: 500 });
  }
}


