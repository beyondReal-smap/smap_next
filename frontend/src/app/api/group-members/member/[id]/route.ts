import { NextRequest, NextResponse } from 'next/server';

// 목업 데이터
const mockGroupMembers = [
  {
    mt_idx: 1186,
    mt_name: '김철수',
    mt_hp: '010-1234-5678',
    mt_image: '/images/avatar3.png',
    mt_lat: '37.5692',
    mt_long: '127.0036'
  },
  {
    mt_idx: 1187,
    mt_name: '이영희',
    mt_hp: '010-2345-6789',
    mt_image: '/images/avatar1.png',
    mt_lat: '37.5612',
    mt_long: '126.9966'
  },
  {
    mt_idx: 1188,
    mt_name: '박민수',
    mt_hp: '010-3456-7890',
    mt_image: '/images/avatar2.png',
    mt_lat: '37.5662',
    mt_long: '126.9986'
  }
];

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const memberId = params.id;
  
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
    return NextResponse.json(mockGroupMembers);
  } catch (error) {
    console.error('그룹 멤버 조회 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
} 