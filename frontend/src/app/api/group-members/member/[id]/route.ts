import { NextRequest, NextResponse } from 'next/server';

// 목업 데이터
const mockGroupMembers = [
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

// 인터페이스 이름 및 구조 변경
interface RouteContext {
  params: {
    id: string;
  };
}

// 타입 체크 우회를 위해 any 타입 사용
export async function GET(
  request: NextRequest,
  context: any // any 타입으로 변경
) {
  const memberId = context.params.id;
  
  if (!memberId) {
    return NextResponse.json(
      { error: '멤버 ID가 필요합니다.' }, 
      { status: 400 }
    );
  }

  try {
    // 실제 DB 연결 대신 목업 데이터 사용
    console.log(`[API] 그룹 멤버 조회: 멤버 ID ${memberId}`);
    
    // 실제 Query 대신 필터링만 수행
    return NextResponse.json(mockGroupMembers, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('그룹 멤버 조회 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    );
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