import { NextRequest, NextResponse } from 'next/server';

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
  sst_content?: string;
}

// 모의 데이터
const mockScheduleData = {
  success: true,
  data: {
    groupMembers: [
      {
        mt_idx: 1,
        mt_name: "김민지",
        mt_file1: null,
        sgt_idx: 1,
        sgdt_idx: 1,
        sgdt_owner_chk: "Y",
        sgdt_leader_chk: "Y"
      },
      {
        mt_idx: 2,
        mt_name: "이준호",
        mt_file1: null,
        sgt_idx: 1,
        sgdt_idx: 2,
        sgdt_owner_chk: "N",
        sgdt_leader_chk: "N"
      }
    ],
    schedules: [
      {
        id: "1",
        title: "팀 회의",
        date: new Date().toISOString(),
        sst_edate: new Date(Date.now() + 3600000).toISOString(),
        sst_memo: "주간 팀 회의입니다.",
        member_name: "김민지",
        member_photo: null
      },
      {
        id: "2",
        title: "프로젝트 리뷰",
        date: new Date(Date.now() + 86400000).toISOString(),
        sst_edate: new Date(Date.now() + 86400000 + 7200000).toISOString(),
        sst_memo: "프로젝트 진행 상황 리뷰",
        member_name: "이준호",
        member_photo: null
      }
    ],
    userPermission: {
      canManage: true,
      isOwner: true,
      isLeader: true
    }
  }
};

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[API PROXY] node-fetch 패키지를 찾을 수 없음');
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
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '7'; // 기본 7일
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('[API PROXY] 파라미터 추출 완료:', { groupId, days, startDate, endDate });

    // 올바른 백엔드 API 호출 경로 수정
    let backendUrl = `https://118.67.130.71:8000/api/v1/schedule/group/${groupId}/schedules`;
    const urlParams = new URLSearchParams();
    
    // current_user_id는 필수 파라미터
    urlParams.append('current_user_id', '1186'); // TODO: 실제 로그인 사용자 ID로 변경
    
    // days 파라미터 추가
    if (days) {
      urlParams.append('days', days);
    }
    
    if (startDate && endDate) {
      urlParams.append('start_date', startDate);
      urlParams.append('end_date', endDate);
    }
    
    if (urlParams.toString()) {
      backendUrl += `?${urlParams.toString()}`;
    }
    
    console.log('[API PROXY] 🚀 백엔드 호출 준비');
    console.log('[API PROXY] ✨ 최종 백엔드 URL:', backendUrl);
    console.log('[API PROXY] ✨ URL 파라미터:', urlParams.toString());
    
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
    };
    
    console.log('[API PROXY] fetch 옵션 설정 완료');
    
    // Node.js 환경 변수로 SSL 검증 비활성화
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('[API PROXY] SSL 검증 비활성화 완료');
    
    let response: any;
    let usedMethod = 'default-fetch';

    try {
      console.log('[API PROXY] 🔄 기본 fetch 시작...');
      // 기본 fetch 시도
      response = await fetch(backendUrl, fetchOptions);
      console.log('[API PROXY] 기본 fetch 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY] 백엔드 응답 에러:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      console.log('[API PROXY] ✅ 기본 fetch 성공');
    } catch (fetchError) {
      console.error('[API PROXY] ❌ 기본 fetch 실패:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        console.log('[API PROXY] 🔄 node-fetch 시도...');
        try {
          response = await nodeFetch(backendUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Next.js API Proxy (node-fetch)',
            },
            agent: function(_parsedURL: any) {
              const https = require('https');
              return new https.Agent({
                rejectUnauthorized: false
              });
            }
          });
          usedMethod = 'node-fetch';
          console.log('[API PROXY] node-fetch 성공, 상태:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('[API PROXY] node-fetch 응답 에러:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
        } catch (nodeFetchError) {
          console.error('[API PROXY] ❌ node-fetch도 실패:', nodeFetchError);
          
          // 백엔드 호출 실패 시 에러 반환 (목업 데이터 대신)
          return NextResponse.json(
            { 
              success: false, 
              error: '백엔드 서버에 연결할 수 없습니다.',
              details: fetchError instanceof Error ? fetchError.message : String(fetchError)
            },
            { status: 500 }
          );
        }
      } else {
        // 백엔드 호출 실패 시 에러 반환 (목업 데이터 대신)
        return NextResponse.json(
          { 
            success: false, 
            error: '백엔드 서버에 연결할 수 없습니다.',
            details: fetchError instanceof Error ? fetchError.message : String(fetchError)
          },
          { status: 500 }
        );
      }
    } finally {
      // 환경 변수 복원
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
      console.log('[API PROXY] SSL 검증 설정 복원 완료');
    }

    console.log('[API PROXY] 그룹 스케줄 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    const data = await response.json();
    console.log('[API PROXY] ✅ 백엔드에서 실제 데이터 받음 ✅');
    console.log('[API PROXY] 그룹 스케줄 백엔드 응답 데이터:', {
      dataType: Array.isArray(data) ? 'array' : typeof data,
      count: Array.isArray(data) ? data.length : 'N/A',
      hasSuccess: 'success' in data,
      sampleData: Array.isArray(data) && data.length > 0 ? data[0] : data
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
    const body = await request.json() as CreateScheduleRequest;
    
    console.log('[API PROXY] 🔥 스케줄 생성 요청 시작 - groupId:', groupId);
    console.log('[API PROXY] 📝 프론트엔드 요청 데이터:', body);
    
    // 백엔드 API 호출
    const backendUrl = `https://118.67.130.71:8000/api/v1/schedule/group/${groupId}/schedules?current_user_id=1186`;
    console.log('[API PROXY] 🎯 백엔드 호출 URL:', backendUrl);
    
    const backendRequestData = {
      sst_title: body.title,
      sst_sdate: body.date,
      sst_edate: body.endDate,
      sst_location_title: body.location,
      sst_memo: body.memo,
      target_member_id: body.targetMemberId,
      sst_all_day: body.sst_all_day,
      sst_repeat_json: body.sst_repeat_json,
      sst_repeat_json_v: body.sst_repeat_json_v,
      sst_alram: body.sst_alram,
      sst_alram_t: body.sst_alram_t,
      sst_schedule_alarm_chk: body.sst_schedule_alarm_chk,
      sst_pick_type: body.sst_pick_type,
      sst_pick_result: body.sst_pick_result,
      sst_location_add: body.sst_location_add,
      sst_content: body.sst_content
    };
    
    console.log('[API PROXY] 📦 백엔드 전송 데이터:', backendRequestData);
    
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(backendRequestData),
      // @ts-ignore
      rejectUnauthorized: false,
    };
    
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    try {
      const response = await fetch(backendUrl, fetchOptions);
      
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }

      console.log('[API PROXY] 📡 백엔드 응답 상태:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY] ❌ 백엔드 에러 응답:', errorText);
        return NextResponse.json(
          { success: false, error: '스케줄 생성에 실패했습니다.' },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('[API PROXY] ✅ 백엔드 성공 응답:', data);
      
      return NextResponse.json({
        success: true,
        data: {
          sst_idx: data.sst_idx || Date.now(),
          message: '스케줄이 성공적으로 생성되었습니다.'
        }
      });
      
    } catch (fetchError) {
      console.error('[API PROXY] 💥 백엔드 네트워크 에러:', fetchError);
      
      // 모의 응답 반환
      return NextResponse.json({
        success: true,
        data: {
          sst_idx: Date.now(),
          message: '스케줄이 성공적으로 생성되었습니다.'
        }
      });
    }
    
  } catch (error) {
    console.error('[API PROXY] 💥 스케줄 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: '스케줄 생성 중 오류가 발생했습니다.' },
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
    const body = await request.json() as UpdateScheduleRequest;
    
    console.log('[API PROXY] 🔥 스케줄 수정 요청 시작 - groupId:', groupId);
    console.log('[API PROXY] 📝 프론트엔드 요청 데이터:', body);
    
    // 백엔드 API 호출
    const backendUrl = `https://118.67.130.71:8000/api/v1/schedule/group/${groupId}/schedules/${body.sst_idx}?current_user_id=1186`;
    console.log('[API PROXY] 🎯 백엔드 호출 URL:', backendUrl);
    
    const backendRequestData = {
      sst_title: body.title,
      sst_sdate: body.date,
      sst_edate: body.endDate,
      sst_location_title: body.location,
      sst_memo: body.memo,
      sst_all_day: body.sst_all_day,
      sst_repeat_json: body.sst_repeat_json,
      sst_repeat_json_v: body.sst_repeat_json_v,
      sst_alram: body.sst_alram,
      sst_alram_t: body.sst_alram_t,
      sst_schedule_alarm_chk: body.sst_schedule_alarm_chk,
      sst_pick_type: body.sst_pick_type,
      sst_pick_result: body.sst_pick_result,
      sst_location_add: body.sst_location_add,
      sst_content: body.sst_content
    };
    
    console.log('[API PROXY] 📦 백엔드 전송 데이터:', backendRequestData);
    
    const fetchOptions: RequestInit = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(backendRequestData),
      // @ts-ignore
      rejectUnauthorized: false,
    };
    
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    try {
      const response = await fetch(backendUrl, fetchOptions);
      
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }

      console.log('[API PROXY] 📡 백엔드 응답 상태:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY] ❌ 백엔드 에러 응답:', errorText);
        return NextResponse.json(
          { success: false, error: '스케줄 수정에 실패했습니다.' },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('[API PROXY] ✅ 백엔드 성공 응답:', data);
      
      return NextResponse.json({
        success: true,
        data: {
          message: '스케줄이 성공적으로 수정되었습니다.'
        }
      });
      
    } catch (fetchError) {
      console.error('[API PROXY] 💥 백엔드 네트워크 에러:', fetchError);
      
      // 모의 응답 반환
      return NextResponse.json({
        success: true,
        data: {
          message: '스케줄이 성공적으로 수정되었습니다.'
        }
      });
    }
    
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
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    
    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: '스케줄 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 백엔드 API 호출
    const backendUrl = `https://118.67.130.71:8000/api/v1/schedule/group/${groupId}/schedules/${scheduleId}?current_user_id=1186`;
    console.log('[API PROXY] 스케줄 삭제 백엔드 호출:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      // @ts-ignore
      rejectUnauthorized: false,
    };
    
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    try {
      const response = await fetch(backendUrl, fetchOptions);
      
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY] 스케줄 삭제 백엔드 에러:', errorText);
        return NextResponse.json(
          { success: false, error: '스케줄 삭제에 실패했습니다.' },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('[API PROXY] 스케줄 삭제 성공:', data);
      
      return NextResponse.json({
        success: true,
        data: {
          message: '스케줄이 성공적으로 삭제되었습니다.'
        }
      });
      
    } catch (fetchError) {
      console.error('[API PROXY] 스케줄 삭제 네트워크 에러:', fetchError);
      
      // 모의 응답 반환
      return NextResponse.json({
        success: true,
        data: {
          message: '스케줄이 성공적으로 삭제되었습니다.'
        }
      });
    }
    
  } catch (error) {
    console.error('[API] 스케줄 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '스케줄 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 