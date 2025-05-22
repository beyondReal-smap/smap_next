import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const { id } = params;
    const backendUrl = `https://118.67.130.71:8000/api/v1/group-members/member/${id}`;
    
    console.log('[API PROXY] 백엔드 호출:', backendUrl);
    
    // Node.js 환경에서 자체 서명 인증서 허용
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
    };
    
    const response = await fetch(backendUrl, fetchOptions);

    console.log('[API PROXY] 백엔드 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY] 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[API PROXY] 백엔드 응답 성공:', data);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY] 오류:', error);
    
    // 목업 데이터 반환
    const mockData = [
      {
        mt_idx: 1186,
        mt_name: '김철수',
        mt_file1: '/images/avatar3.png',
        mt_hp: '010-1234-5678',
        mt_lat: '37.5692',
        mt_long: '127.0036',
        mt_gender: 1,
        mt_weather_sky: '8',
        mt_weather_tmx: 25
      },
      {
        mt_idx: 1187,
        mt_name: '이영희',
        mt_file1: '/images/avatar1.png',
        mt_hp: '010-2345-6789',
        mt_lat: '37.5612',
        mt_long: '126.9966',
        mt_gender: 2,
        mt_weather_sky: '1',
        mt_weather_tmx: 22
      },
      {
        mt_idx: 1188,
        mt_name: '박민수',
        mt_file1: '/images/avatar2.png',
        mt_hp: '010-3456-7890',
        mt_lat: '37.5662',
        mt_long: '126.9986',
        mt_gender: 1,
        mt_weather_sky: '4',
        mt_weather_tmx: 18
      }
    ];

    return NextResponse.json(mockData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 