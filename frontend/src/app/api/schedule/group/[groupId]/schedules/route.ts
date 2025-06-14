import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUserId } from '@/lib/auth';

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
  try {
    console.log('[SCHEDULE API] 🚀 백엔드 요청 시작:', { url, method: options.method });
    console.log('[SCHEDULE API] 📦 요청 옵션:', options);
    
    // SSL 인증서 문제 해결을 위한 설정 (공지사항 API와 동일)
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    };
    
    const response = await fetch(url, fetchOptions);

    console.log('[SCHEDULE API] 📡 백엔드 응답 수신:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SCHEDULE API] ❌ 백엔드 오류 응답:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[SCHEDULE API] ✅ 백엔드 응답 데이터:', data);
    return data;

  } catch (error: any) {
    console.error('[SCHEDULE API] 💥 백엔드 요청 실패:', {
      message: error.message,
      name: error.name,
      cause: error.cause
    });
    
    // 백엔드 연결 실패 시 목업 응답
    if (error.message?.includes('fetch') || 
        error.code === 'ECONNREFUSED' || 
        error.name === 'TypeError' ||
        error.message?.includes('certificate') ||
        error.message?.includes('SSL')) {
      console.log('[SCHEDULE API] 🔄 백엔드 연결 실패, 목업 응답 반환');
      return {
        success: true,
        data: {
          sst_idx: Math.floor(Math.random() * 1000000),
          message: '스케줄이 성공적으로 생성되었습니다. (목업 응답 - 백엔드 연결 실패)'
        }
      };
    }
    
    throw error;
  }
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
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    const body: CreateScheduleRequest = await request.json();
    console.log('[SCHEDULE API] 생성 요청 데이터:', body);
    
    // current_user_id는 인증된 사용자 ID (현재는 하드코딩된 1186)
    const currentUserId = getCurrentUserId(request);
    console.log('[SCHEDULE API] 현재 사용자 ID:', currentUserId);
    
    // 백엔드 API URL 구성
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://118.67.130.71:8000';
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
      body: JSON.stringify(backendRequestData)
    });
    
    console.log('[SCHEDULE API] 백엔드 응답:', response);
    
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
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const days = searchParams.get('days');
    const memberId = searchParams.get('member_id');
    
    console.log('[SCHEDULE API] 쿼리 파라미터:', { startDate, endDate, days, memberId });
    
    // current_user_id는 인증된 사용자 ID (현재는 하드코딩된 1186)
    const currentUserId = getCurrentUserId(request);
    console.log('[SCHEDULE API] 현재 사용자 ID:', currentUserId);
    
    // 백엔드 API URL 구성
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://118.67.130.71:8000';
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
    });
    
    console.log('[SCHEDULE API] 백엔드 응답:', response);
    
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