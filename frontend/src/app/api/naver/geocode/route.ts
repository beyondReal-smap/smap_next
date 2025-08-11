import { NextRequest } from 'next/server';
import { proxyJson } from '../_client';

// GET /api/naver/geocode?query=주소
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  if (!query) {
    return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
  }
  return proxyJson('/map-geocode/v2/geocode', searchParams);
}


