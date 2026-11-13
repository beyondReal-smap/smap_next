import { NextRequest, NextResponse } from 'next/server';
import { requireSignedMapAuth } from '@/lib/auth';

const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = 60 * 1000;
const CACHE_LIMIT = 200;

export async function GET(request: NextRequest) {
  const authError = requireSignedMapAuth(request);
  if (authError) return authError;

  const params = request.nextUrl.searchParams;
  const query = params.get('query')?.trim();
  const lat = params.get('lat');
  const lng = params.get('lng');
  const isCoordinates = lat !== null || lng !== null;
  if (isCoordinates) {
    if (lat === null || lng === null || !lat.trim() || !lng.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) {
      return NextResponse.json({ error: '좌표가 올바르지 않습니다.' }, { status: 400 });
    }
  } else if (!query || query.length > 100) {
    return NextResponse.json({ error: '검색어는 1자 이상 100자 이하여야 합니다.' }, { status: 400 });
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    console.error('[kakao-search] KAKAO_REST_API_KEY가 설정되지 않았습니다.');
    return NextResponse.json({ error: '카카오 API 설정 오류' }, { status: 500 });
  }
  const cacheKey = isCoordinates ? `coord:${lat},${lng}` : `query:${query}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.data);
  if (cached) cache.delete(cacheKey);

  try {
    const url = new URL(isCoordinates
      ? 'https://dapi.kakao.com/v2/local/geo/coord2address.json'
      : 'https://dapi.kakao.com/v2/local/search/keyword.json');
    if (isCoordinates) {
      url.searchParams.set('x', lng!);
      url.searchParams.set('y', lat!);
    } else {
      url.searchParams.set('query', query!);
    }
    const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: 'no-store' });
    if (!response.ok) {
      console.error('[kakao-search] 카카오 API 오류:', response.status);
      return NextResponse.json({ error: '카카오 API 호출 실패' }, { status: 502 });
    }
    const data = await response.json();
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[kakao-search] 서버 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
  }
}
