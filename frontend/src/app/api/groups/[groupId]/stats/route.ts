import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    console.log(`[API] 그룹 통계 조회 요청 - groupId: ${groupId}`);

    // 백엔드 API 호출
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.smap.site'}/api/v1/groups/${groupId}/stats`;
    console.log(`[API] 백엔드 요청 URL: ${backendUrl}`);

    try {
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // 타임아웃 설정
        signal: AbortSignal.timeout(5000)
      });

      console.log(`[API] 백엔드 응답 상태: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          data: data,
          message: '그룹 통계 조회 성공'
        });
      } else {
        console.error(`[API] 백엔드 응답 오류: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError) {
      console.error(`[API] 백엔드 연결 실패:`, fetchError);
    }

    // 백엔드 연결 실패 시 빈 데이터 반환 (목업 데이터 제거)
    const emptyStats = {
      group_id: parseInt(groupId),
      group_title: "",
      member_count: 0,
      weekly_schedules: 0,
      total_locations: 0,
      stats_period: {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        days: 7
      },
      member_stats: []
    };

    return NextResponse.json({
      success: false,
      data: emptyStats,
      message: '그룹 통계 데이터를 가져오는 데 실패했습니다.'
    }, { status: 500 });

  } catch (error) {
    console.error('[API] 그룹 통계 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 내부 오류가 발생했습니다.'
    }, { status: 500 });
  }
}