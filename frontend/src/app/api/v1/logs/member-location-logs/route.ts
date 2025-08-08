import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'https://api3.smap.site';

async function fetchWithInsecureTLS(url: string, options: RequestInit = {}) {
  try {
    if (typeof require !== 'undefined') {
      try {
        const fetch = require('node-fetch');
        const https = require('https');
        const agent = new https.Agent({ rejectUnauthorized: false });
        return await fetch(url, { ...options, agent });
      } catch {}
    }
    return await fetch(url, options);
  } catch (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const original = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    const body = await request.json();

    if (!body.act) {
      return NextResponse.json({ result: 'N', message: "'act' parameter is required" }, { status: 400 });
    }

    const res = await fetchWithInsecureTLS(`${BACKEND_URL}/api/v1/logs/member-location-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { result: 'N', message: 'Invalid JSON from backend', raw: text };
    }

    return NextResponse.json(json, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ result: 'N', message: 'Proxy error', detail: error?.message || String(error) }, { status: 502 });
  } finally {
    if (original !== undefined) process.env.NODE_TLS_REJECT_UNAUTHORIZED = original; else delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}