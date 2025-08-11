import { NextRequest } from 'next/server';
import { proxyJson } from '../_client';

// GET /api/naver/directions5?start=127.1054328,37.3595963&goal=127.1080096,37.3663166&option=trafast
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const goal = searchParams.get('goal');
  if (!start || !goal) {
    return new Response(JSON.stringify({ error: 'start and goal are required' }), { status: 400 });
  }
  return proxyJson('/map-direction/v1/driving', searchParams);
}


