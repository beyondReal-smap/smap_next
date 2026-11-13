import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';

interface UpdateScheduleRequest {
  sst_title?: string;
  sst_sdate?: string;
  sst_edate?: string;
  sst_all_day?: 'Y' | 'N';
  sst_location_title?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_memo?: string;
  sst_repeat_json?: string;
  sst_repeat_json_v?: string;
  sst_alram_t?: string;
  sst_schedule_alarm_chk?: 'Y' | 'N';
  sst_pick_type?: string;
  sst_pick_result?: string;
  // 반복 일정 처리 옵션
  editOption?: 'this' | 'future' | 'all';
  targetMemberId?: number;
}

interface DeleteScheduleRequest {
  // 반복 일정 처리 옵션
  deleteOption?: 'this' | 'future' | 'all';
  sst_pidx?: number | null; // 반복 일정의 부모 ID
  sgdt_idx?: number | null; // 그룹 상세 ID (null 허용)
  targetMemberId?: number; // 다른 멤버 스케줄 삭제 시
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
 * 개별 스케줄 수정 (반복 일정 옵션 지원)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; scheduleId: string }> }
) {
  console.log('[SCHEDULE API] ✏️ 개별 스케줄 수정 요청 시작');
  
  const { groupId, scheduleId } = await params;
  console.log('[SCHEDULE API] 파라미터:', { groupId, scheduleId });
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    const body: UpdateScheduleRequest = await request.json();
    const { editOption, targetMemberId, ...scheduleData } = body;
    const currentUserId = user.mt_idx;
    
    // 백엔드 API URL 구성
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.aiagnt.kr';
    let apiUrl = `${backendUrl}/api/v1/schedule/group/${groupId}/schedules/${scheduleId}?current_user_id=${currentUserId}`;
    
    // 반복 일정 처리 옵션에 따른 URL 및 데이터 구성
    let requestData: any = {
      ...scheduleData,
      // targetMemberId는 백엔드 요청 데이터에 포함
      ...(targetMemberId && { targetMemberId })
    };
    
    if (editOption && editOption !== 'this') {
      // 반복 일정 처리 옵션이 있는 경우
      requestData.editOption = editOption;
      console.log('[SCHEDULE API] 반복 일정 수정 옵션:', editOption);
    }
    
    console.log('[SCHEDULE API] 백엔드 요청 URL:', apiUrl);
    console.log('[SCHEDULE API] 백엔드 요청 데이터:', requestData);
    
    // 백엔드 API 호출
    const response = await makeBackendRequest(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestData),
    });
    
    if (response.success) {
      return NextResponse.json({
        success: true,
        data: {
          message: editOption === 'all' 
            ? '모든 반복 일정이 성공적으로 수정되었습니다.'
            : editOption === 'future'
            ? '현재 이후의 반복 일정이 성공적으로 수정되었습니다.'
            : '일정이 성공적으로 수정되었습니다.'
        }
      });
    } else {
      throw new Error(response.error || '스케줄 수정에 실패했습니다.');
    }
    
  } catch (error: any) {
    console.error('[SCHEDULE API] 스케줄 수정 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || '스케줄 수정 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * 개별 스케줄 삭제 (반복 일정 옵션 지원)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; scheduleId: string }> }
) {
  console.log('[SCHEDULE API] 🗑️ 개별 스케줄 삭제 요청 시작');
  
  const { groupId, scheduleId } = await params;
  console.log('[SCHEDULE API] 파라미터:', { groupId, scheduleId });
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    // 요청 본문에서 삭제 옵션 추출 (선택사항)
    let deleteOption: string | undefined;
    let sst_pidx: number | null = null;
    let sgdt_idx: number | null = null;
    let targetMemberId: number | undefined;
    try {
      const body: DeleteScheduleRequest = await request.json();
      deleteOption = body.deleteOption;
      sst_pidx = body.sst_pidx || null;
      sgdt_idx = body.sgdt_idx || null;
      targetMemberId = body.targetMemberId;
    } catch (e) {
      // 본문이 없는 경우 기본 삭제
    }
    
    const currentUserId = user.mt_idx;
    
    // 백엔드 API URL 구성
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.aiagnt.kr';
    let apiUrl = `${backendUrl}/api/v1/schedule/group/${groupId}/schedules/${scheduleId}?current_user_id=${currentUserId}`;
    
    // 요청 데이터 구성
    let requestData: any = {};
    
    if (deleteOption && deleteOption !== 'this') {
      // 반복 일정 처리 옵션이 있는 경우
      requestData.deleteOption = deleteOption;
      console.log('[SCHEDULE API] 반복 일정 삭제 옵션:', deleteOption);
    }
    
    if (sst_pidx !== null) {
      // 반복 일정의 부모 ID가 있는 경우
      requestData.sst_pidx = sst_pidx;
      console.log('[SCHEDULE API] 반복 일정 부모 ID 전달:', sst_pidx);
    }
    
    if (sgdt_idx !== null) {
      // 그룹 상세 ID가 있는 경우
      requestData.sgdt_idx = sgdt_idx;
      console.log('[SCHEDULE API] 그룹 상세 ID 전달:', sgdt_idx);
    }
    
    if (targetMemberId !== undefined) {
      // 대상 멤버 ID가 있는 경우
      requestData.targetMemberId = targetMemberId;
      console.log('[SCHEDULE API] 대상 멤버 ID 전달:', targetMemberId);
    }
    
    console.log('[SCHEDULE API] 백엔드 요청 URL:', apiUrl);
    console.log('[SCHEDULE API] 백엔드 요청 데이터:', requestData);
    
    // 백엔드 API 호출
    const response = await makeBackendRequest(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestData),
    });
    
    if (response.success) {
      return NextResponse.json({
        success: true,
        data: {
          message: deleteOption === 'all' 
            ? '모든 반복 일정이 성공적으로 삭제되었습니다.'
            : deleteOption === 'future'
            ? '현재 이후의 반복 일정이 성공적으로 삭제되었습니다.'
            : '일정이 성공적으로 삭제되었습니다.'
        }
      });
    } else {
      throw new Error(response.error || '스케줄 삭제에 실패했습니다.');
    }
    
  } catch (error: any) {
    console.error('[SCHEDULE API] 스케줄 삭제 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || '스케줄 삭제 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * 개별 스케줄 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; scheduleId: string }> }
) {
  console.log('[SCHEDULE API] 📋 개별 스케줄 조회 요청 시작');
  
  const { groupId, scheduleId } = await params;
  console.log('[SCHEDULE API] 파라미터:', { groupId, scheduleId });
  
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    // 쿼리 파라미터에서 targetMemberId 추출
    const { searchParams } = new URL(request.url);
    const targetMemberId = searchParams.get('targetMemberId') ? parseInt(searchParams.get('targetMemberId')!) : undefined;
    
    const currentUserId = user.mt_idx;
    
    // 백엔드 API URL 구성
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.aiagnt.kr';
    const apiUrl = `${backendUrl}/api/v1/schedule/group/${groupId}/schedules/${scheduleId}?current_user_id=${currentUserId}`;
    
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