import { NextResponse } from 'next/server';

const NAVER_MAP_BASE = 'https://maps.apigw.ntruss.com';

function getAuthHeaders() {
  const keyId = process.env.NAVER_MAPS_API_KEY_ID || process.env.NCP_ACCESS_KEY || process.env.NAVER_CLIENT_ID;
  const key = process.env.NAVER_MAPS_API_KEY || process.env.NCP_SECRET_KEY || process.env.NAVER_CLIENT_SECRET;

  if (!keyId || !key) {
    throw new Error('Naver Maps API credentials are not configured');
  }

  return {
    'X-NCP-APIGW-API-KEY-ID': keyId as string,
    'X-NCP-APIGW-API-KEY': key as string,
  } as const;
}

export async function proxyJson(path: string, searchParams: URLSearchParams) {
  const url = new URL(path, NAVER_MAP_BASE);
  searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      ...getAuthHeaders(),
    },
    // Naver expects GET for these endpoints by default
    method: 'GET',
    // 10s timeout via AbortSignal in Node 18+ is not trivial; keep default
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json({ ok: false, status: res.status, error: text || res.statusText }, { status: res.status });
  }

  if (contentType.includes('application/json')) {
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  }

  const text = await res.text();
  return NextResponse.json({ raw: text }, { status: 200 });
}

export async function proxyBinary(path: string, searchParams: URLSearchParams) {
  const url = new URL(path, NAVER_MAP_BASE);
  searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      ...getAuthHeaders(),
    },
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json({ ok: false, status: res.status, error: text || res.statusText }, { status: res.status });
  }

  const contentType = res.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await res.arrayBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}


