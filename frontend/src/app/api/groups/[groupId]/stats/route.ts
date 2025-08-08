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
    console.log(`[API] 환경변수 NEXT_PUBLIC_BACKEND_URL: ${process.env.NEXT_PUBLIC_BACKEND_URL}`);

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
        console.log(`[API] 백엔드 응답 성공:`, data);

        return NextResponse.json({
          success: true,
          data: data,
          message: '그룹 통계 조회 성공'
        });
      } else {
        console.error(`[API] 백엔드 응답 오류: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`[API] 오류 내용: ${errorText}`);
      }
    } catch (fetchError) {
      console.error(`[API] 백엔드 연결 실패:`, fetchError);
    }
    
    // 백엔드 연결 실패 시 목업 데이터 반환
    const mockStats = {
      group_id: parseInt(groupId),
      group_title: "테스트 그룹",
      member_count: 3,
      weekly_schedules: 12,
      total_locations: 8,
      stats_period: {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        days: 7
      },
      member_stats: [
        {
          mt_idx: 1186,
          mt_name: "김철수",
          mt_nickname: "철수",
          weekly_schedules: 5,
          total_locations: 3,
          weekly_locations: 2,
          is_owner: true,
          is_leader: false
        },
        {
          mt_idx: 1187,
          mt_name: "이영희",
          mt_nickname: "영희",
          weekly_schedules: 4,
          total_locations: 3,
          weekly_locations: 1,
          is_owner: false,
          is_leader: true
        },
        {
          mt_idx: 1188,
          mt_name: "박민수",
          mt_nickname: "민수",
          weekly_schedules: 3,
          total_locations: 2,
          weekly_locations: 1,
          is_owner: false,
          is_leader: false
        }
      ]
    };

    console.log('[API] 목업 통계 데이터 반환');
    return NextResponse.json({
      success: true,
      data: mockStats,
      message: '백엔드 연결 실패로 목업 데이터 반환'
    });

  } catch (error) {
    console.error('[API] 그룹 통계 조회 오류:', error);
    
    // 오류 발생 시에도 목업 데이터 반환
    const mockStats = {
      group_id: 1,
      group_title: "테스트 그룹",
      member_count: 3,
      weekly_schedules: 12,
      total_locations: 8,
      stats_period: {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        days: 7
      },
      member_stats: [
        {
          mt_idx: 1186,
          mt_name: "김철수",
          mt_nickname: "철수",
          weekly_schedules: 5,
          total_locations: 3,
          weekly_locations: 2,
          is_owner: true,
          is_leader: false
        },
        {
          mt_idx: 1187,
          mt_name: "이영희",
          mt_nickname: "영희",
          weekly_schedules: 4,
          total_locations: 3,
          weekly_locations: 1,
          is_owner: false,
          is_leader: true
        },
        {
          mt_idx: 1188,
          mt_name: "박민수",
          mt_nickname: "민수",
          weekly_schedules: 3,
          total_locations: 2,
          weekly_locations: 1,
          is_owner: false,
          is_leader: false
        }
      ]
    };

    return NextResponse.json({
      success: true,
      data: mockStats,
      message: '오류로 인한 목업 데이터 반환'
    });
  }
} 