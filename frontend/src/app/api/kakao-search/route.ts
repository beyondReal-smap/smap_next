import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: '검색어가 필요합니다.' },
        { status: 400 }
      );
    }

    const KAKAO_API_KEY = 'bc7899314df5dc2bebcb2a7960ac89bf';
    const kakaoUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;

    console.log('[kakao-search] API 호출:', { query, kakaoUrl });

    const response = await fetch(kakaoUrl, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[kakao-search] 카카오 API 오류:', response.status, response.statusText);
      return NextResponse.json(
        { error: '카카오 API 호출 실패' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[kakao-search] 카카오 API 응답 성공:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[kakao-search] 서버 오류:', error);
    return NextResponse.json(
      { error: '서버 내부 오류' },
      { status: 500 }
    );
  }
} 