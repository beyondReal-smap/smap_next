import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';
import { extractAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ result: 'N', message: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const body = await request.json();

    if (!body.act) {
      return NextResponse.json({ result: 'N', message: "'act' parameter is required" }, { status: 400 });
    }

    const backendBase = resolveBackendBaseUrl();
    const res = await fetch(`${backendBase}/api/v1/logs/member-location-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
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