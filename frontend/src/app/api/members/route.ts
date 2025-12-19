import { NextRequest, NextResponse } from 'next/server';

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

    // 더미 데이터 반환 제거 (보안 및 데이터 정확성을 위해 빈 배열 반환)
    if (memberId) {
      return NextResponse.json([], { status: 404 });
    } else {
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error('멤버 조회 오류:', error);
    return NextResponse.json(
      { error: '멤버 데이터를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}