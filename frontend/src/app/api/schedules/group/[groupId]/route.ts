import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';
import resolveBackendBaseUrl from '../../../_utils/backend';

interface Schedule {
  id: string;
  sst_pidx?: number | null;
  mt_schedule_idx?: number | null;
  title?: string | null;
  date?: string | null;
  sst_edate?: string | null;
  sst_location_title?: string | null;
  sst_location_lat?: number | null;
  sst_location_long?: number | null;
  sst_memo?: string | null;
  sst_wdate?: string | null;
}

interface GroupMember {
  mt_idx: number;
  mt_name: string;
  mt_file1?: string | null;
  sgt_idx: number;
  sgdt_idx: number;
  sgdt_owner_chk: 'Y' | 'N';
  sgdt_leader_chk: 'Y' | 'N';
}

interface CreateScheduleRequest {
  title: string;
  date: string;
  endDate: string;
  location?: string;
  memo?: string;
  targetMemberId?: number;
  sst_all_day?: 'Y' | 'N';
  sst_repeat_json?: string;
  sst_repeat_json_v?: string;
  sst_alram?: string;
  sst_alram_t?: string;
  sst_schedule_alarm_chk?: 'Y' | 'N';
  sst_pick_type?: string;
  sst_pick_result?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_content?: string;
}

interface UpdateScheduleRequest {
  sst_idx: number;
  title?: string;
  date?: string;
  endDate?: string;
  location?: string;
  memo?: string;
  sst_all_day?: 'Y' | 'N';
  sst_repeat_json?: string;
  sst_repeat_json_v?: string;
  sst_alram?: string;
  sst_alram_t?: string;
  sst_schedule_alarm_chk?: 'Y' | 'N';
  sst_pick_type?: string;
  sst_pick_result?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_content?: string;
}

async function fetchBackendJson(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  console.log('[API PROXY] ⭐ GET 요청 시작 ⭐');
  
  const { groupId } = await params;
  console.log('[API PROXY] 그룹 ID:', groupId);
  console.log('[API PROXY] 요청 URL:', request.url);
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days') || '7'; // 기본 7일
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    console.log('[API PROXY] 파라미터 추출 완료:', { groupId, days: daysParam, startDate, endDate });

    // 올바른 백엔드 API 호출 경로
    let backendUrl = `${resolveBackendBaseUrl()}/api/v1/schedule/group/${encodeURIComponent(groupId)}/schedules`;
    const urlParams = new URLSearchParams();
    
    // current_user_id는 필수 파라미터 - 실제 로그인 사용자 ID 사용
    const currentUserId = user.mt_idx;
    urlParams.append('current_user_id', currentUserId.toString());
    
    // 백엔드가 days를 직접 지원하지 않을 수 있으므로 서버에서 기간 계산
    if (!startDate || !endDate) {
      const days = Math.max(1, parseInt(daysParam, 10) || 7);
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const start = new Date(now);
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
      const toMysql = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      startDate = toMysql(start);
      endDate = toMysql(end);
    }

    if (startDate && endDate) {
      urlParams.append('start_date', startDate);
      urlParams.append('end_date', endDate);
    }
    
    if (urlParams.toString()) {
      backendUrl += `?${urlParams.toString()}`;
    }
    
    const data = await fetchBackendJson(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return NextResponse.json(data);

  } catch (error) {
    console.error('[API PROXY] ❌ 최상위 catch 블록 실행');
    console.error('[API PROXY] 그룹 스케줄 조회 오류:', error);
    console.error('[API PROXY] 에러 타입:', typeof error);
    console.error('[API PROXY] 에러 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    // 에러 발생 시 에러 응답 반환 (목업 데이터 대신)
    return NextResponse.json(
      { 
        success: false, 
        error: '스케줄 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 스케줄 생성 (POST)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json() as CreateScheduleRequest;
    
    // 현재 사용자 ID 확인
    const currentUserId = user.mt_idx;
    
    // 백엔드 API 호출
    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/schedule/group/${encodeURIComponent(groupId)}/schedules?current_user_id=${currentUserId}`;
    
    const backendRequestData = {
      sst_title: body.title,
      sst_sdate: body.date,
      sst_edate: body.endDate,
      sst_location_title: body.location,
      sst_memo: body.memo,
      sst_content: body.sst_content,
      targetMemberId: body.targetMemberId,
      sst_all_day: body.sst_all_day,
      sst_repeat_json: body.sst_repeat_json || null,
      sst_repeat_json_v: body.sst_repeat_json_v || null,
      sst_alram: body.sst_alram,
      sst_alram_t: body.sst_alram_t,
      sst_schedule_alarm_chk: body.sst_schedule_alarm_chk,
      sst_pick_type: body.sst_pick_type,
      sst_pick_result: body.sst_pick_result,
      sst_location_add: body.sst_location_add,
      sst_location_lat: body.sst_location_lat,
      sst_location_long: body.sst_location_long
    };
    
    const data = await fetchBackendJson(backendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(backendRequestData),
    });
    
    return NextResponse.json({
      success: true,
      data: {
        sst_idx: data.sst_idx || data.data?.sst_idx,
        message: data.message || data.data?.message || '스케줄이 성공적으로 생성되었습니다.'
      }
    });
    
  } catch (error) {
    console.error('[API PROXY] 💥 스케줄 생성 오류:', error);
    console.error('[API PROXY] 🔍 에러 상세:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { success: false, error: '스케줄 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 스케줄 수정 (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json() as UpdateScheduleRequest;
    
    // 현재 사용자 ID 확인
    const currentUserId = user.mt_idx;
    
    // 백엔드 API 호출
    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/schedule/group/${encodeURIComponent(groupId)}/schedules/${body.sst_idx}?current_user_id=${currentUserId}`;
    
    const backendRequestData = {
      sst_title: body.title,
      sst_sdate: body.date,
      sst_edate: body.endDate,
      sst_location_title: body.location,
      sst_memo: body.memo,
      sst_content: body.sst_content,
      sst_all_day: body.sst_all_day,
      sst_repeat_json: body.sst_repeat_json || null,
      sst_repeat_json_v: body.sst_repeat_json_v || null,
      sst_alram: body.sst_alram,
      sst_alram_t: body.sst_alram_t,
      sst_schedule_alarm_chk: body.sst_schedule_alarm_chk,
      sst_pick_type: body.sst_pick_type,
      sst_pick_result: body.sst_pick_result,
      sst_location_add: body.sst_location_add,
      sst_location_lat: body.sst_location_lat,
      sst_location_long: body.sst_location_long
    };
    
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(backendRequestData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: '스케줄 수정에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '스케줄이 성공적으로 수정되었습니다.'
      }
    });
    
  } catch (error) {
    console.error('[API PROXY] 💥 스케줄 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: '스케줄 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 스케줄 삭제 (DELETE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    
    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: '스케줄 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 현재 사용자 ID 확인
    const currentUserId = user.mt_idx;
    
    // 백엔드 API 호출
    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/schedule/group/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(scheduleId)}?current_user_id=${currentUserId}`;
    
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: '스케줄 삭제에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '스케줄이 성공적으로 삭제되었습니다.'
      }
    });
    
  } catch (error) {
    console.error('[API] 스케줄 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '스케줄 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 