import { NextRequest } from 'next/server';
import { proxyBinary } from '../_client';

// GET /api/naver/static-map?center=127.1054328,37.3595963&level=16&w=600&h=400
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const center = searchParams.get('center');
  if (!center) {
    return new Response(JSON.stringify({ error: 'center is required' }), { status: 400 });
  }
  return proxyBinary('/map-static/v2/raster', searchParams);
}


