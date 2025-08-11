import { NextRequest } from 'next/server';
import { proxyJson } from '../_client';

// GET /api/naver/reverse-geocode?coords=127.1,37.5&output=json&orders=roadaddr,addr
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coords = searchParams.get('coords');
  if (!coords) {
    return new Response(JSON.stringify({ error: 'coords is required' }), { status: 400 });
  }
  // API 경로 스펙에 맞춤
  return proxyJson('/map-reversegeocode/v2/gc', searchParams);
}


