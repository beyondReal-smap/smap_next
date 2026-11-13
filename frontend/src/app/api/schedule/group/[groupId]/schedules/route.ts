import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';

interface CreateScheduleRequest {
  sst_title?: string;
  sst_sdate?: string;
  sst_edate?: string;
  sst_stime?: string;
  sst_etime?: string;
  sst_all_day?: 'Y' | 'N';
  sst_location_title?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_memo?: string;
  sst_supplies?: string;
  sst_repeat_json?: string;
  sst_repeat_json_v?: string;
  sst_alram_t?: string;
  sst_schedule_alarm_chk?: 'Y' | 'N';
  sst_pick_type?: string;
  sst_pick_result?: string;
  targetMemberId?: number;
}

async function makeBackendRequest(url: string, options: RequestInit): Promise<any> {
  console.log('[SCHEDULE API] 🚀 백엔드 요청 시작:', { url, method: options.method });

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SCHEDULE API] ❌ 백엔드 오류 응답:', {
      status: response.status,
      statusText: response.statusText,
      errorText,
    });
    throw new Error(`Backend API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * 그룹 스케줄 생성
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  console.log('[SCHEDULE API] ➕ 그룹 스케줄 생성 요청 시작');
  
  const { groupId } = await params;
  console.log('[SCHEDULE API] 파라미터:', { groupId });
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    const body: CreateScheduleRequest = await request.json();
    const currentUserId = user.mt_idx;
    
    // 백엔드 API URL 구성
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.aiagnt.kr';
    const apiUrl = `${backendUrl}/api/v1/schedule/group/${groupId}/schedules?current_user_id=${currentUserId}`;
    
    console.log('[SCHEDULE API] 백엔드 요청 URL:', apiUrl);
    
    // 백엔드로 전달할 요청 데이터 구성
    const backendRequestData = {
      sst_title: body.sst_title,
      sst_sdate: body.sst_sdate,
      sst_edate: body.sst_edate,
      sst_all_day: body.sst_all_day,
      sst_location_title: body.sst_location_title,
      sst_location_add: body.sst_location_add,
      sst_location_lat: body.sst_location_lat,
      sst_location_long: body.sst_location_long,
      sst_memo: body.sst_memo,
      sst_supplies: body.sst_supplies,
      sst_repeat_json: body.sst_repeat_json,
      sst_repeat_json_v: body.sst_repeat_json_v,
      sst_alram_t: body.sst_alram_t,
      sst_schedule_alarm_chk: body.sst_schedule_alarm_chk,
      sst_pick_type: body.sst_pick_type,
      sst_pick_result: body.sst_pick_result,
      targetMemberId: body.targetMemberId,
    };

    console.log('[SCHEDULE API] 📦 백엔드 전송 데이터:', backendRequestData);

    const response = await makeBackendRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(backendRequestData)
    });
    
    if (response.success) {
      return NextResponse.json({
        success: true,
        data: {
          sst_idx: response.data.sst_idx,
          message: '스케줄이 성공적으로 생성되었습니다.'
        }
      });
    } else {
      throw new Error(response.error || '스케줄 생성에 실패했습니다.');
    }
    
  } catch (error: any) {
    console.error('[SCHEDULE API] 스케줄 생성 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || '스케줄 생성 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * 그룹 스케줄 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  console.log('[SCHEDULE API] 📋 그룹 스케줄 목록 조회 요청 시작');
  
  const { groupId } = await params;
  console.log('[SCHEDULE API] 파라미터:', { groupId });
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const days = searchParams.get('days');
    const memberId = searchParams.get('member_id');
    
    const currentUserId = user.mt_idx;
    
    // 백엔드 API URL 구성
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.aiagnt.kr';
    let apiUrl = `${backendUrl}/api/v1/schedule/group/${groupId}/schedules?current_user_id=${currentUserId}`;
    
    // 쿼리 파라미터 추가
    if (startDate) apiUrl += `&start_date=${startDate}`;
    if (endDate) apiUrl += `&end_date=${endDate}`;
    if (days) apiUrl += `&days=${days}`;
    if (memberId) apiUrl += `&member_id=${memberId}`;
    
    console.log('[SCHEDULE API] 백엔드 요청 URL:', apiUrl);
    
    // 백엔드 API 호출
    const response = await makeBackendRequest(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.success) {
      return NextResponse.json(response);
    } else {
      throw new Error(response.error || '스케줄 조회에 실패했습니다.');
    }
    
  } catch (error: any) {
    console.error('[SCHEDULE API] 스케줄 조회 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || '스케줄 조회 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
} 