import { NextRequest, NextResponse } from 'next/server';

// 목업 데이터 (실제 DB 연결 불가 시 사용)
const mockMembers = [
  {
    mt_idx: 1186,
    mt_name: '김철수',
    mt_hp: '010-1234-5678',
    mt_email: 'user1@example.com',
    mt_level: 3,
    mt_file1: '/images/avatar3.png',
    mt_lat: '37.5692',
    mt_long: '127.0036',
    mt_regdate: '2023-01-15 14:30:00',
    mt_status: 'Y'
  },
  {
    mt_idx: 1187,
    mt_name: '이영희',
    mt_hp: '010-2345-6789',
    mt_email: 'user2@example.com',
    mt_level: 2,
    mt_file1: '/images/avatar1.png',
    mt_lat: '37.5612',
    mt_long: '126.9966',
    mt_regdate: '2023-02-10 09:15:00',
    mt_status: 'Y'
  },
  {
    mt_idx: 1188,
    mt_name: '박민수',
    mt_hp: '010-3456-7890',
    mt_email: 'user3@example.com',
    mt_level: 2,
    mt_file1: '/images/avatar2.png',
    mt_lat: '37.5662',
    mt_long: '126.9986',
    mt_regdate: '2023-03-05 11:45:00',
    mt_status: 'Y'
  }
];

export async function GET(request: NextRequest) {
  try {
    // URL에서 쿼리 파라미터 가져오기
    const url = new URL(request.url);
    const memberId = url.searchParams.get('id');
    
    // DB 연결 로직 (실제 환경에서는 이 부분을 활성화)
    // if (memberId) {
    //   // 특정 멤버 조회 쿼리
    //   const queryText = `
    //     SELECT mt_idx, mt_name, mt_hp, mt_email, mt_level, mt_file1, mt_lat, mt_long, 
    //            mt_regdate, mt_status
    //     FROM smap_member_t
    //     WHERE mt_idx = ?
    //   `;
    //   const result = await executeQuery(queryText, [memberId]);
    //   return NextResponse.json(result);
    // } else {
    //   // 전체 멤버 조회 쿼리
    //   const queryText = `
    //     SELECT mt_idx, mt_name, mt_hp, mt_email, mt_level, mt_file1, mt_lat, mt_long, 
    //            mt_regdate, mt_status
    //     FROM smap_member_t
    //     WHERE mt_status = 'Y'
    //     ORDER BY mt_idx DESC
    //   `;
    //   const result = await executeQuery(queryText);
    //   return NextResponse.json(result);
    // }
    
    // 목업 데이터 반환 (DB 연결 불가 상황에서 사용)
    if (memberId) {
      const member = mockMembers.find(m => m.mt_idx === parseInt(memberId));
      if (member) {
        return NextResponse.json([member]);
      } else {
        return NextResponse.json([], { status: 404 });
      }
    } else {
      return NextResponse.json(mockMembers);
    }
  } catch (error: any) {
    console.error('멤버 조회 오류:', error);
    return NextResponse.json(
      { error: '멤버 데이터를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 