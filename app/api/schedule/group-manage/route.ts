import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Schedule API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string, options: any = {}): Promise<any> {
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      ...options.headers,
    },
    ...(options.body && { body: options.body }),
    // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
    rejectUnauthorized: false,
  };
  
  // Node.js 환경 변수로 SSL 검증 비활성화
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  let response: any;

  try {
    try {
      // 기본 fetch 시도
      response = await fetch(url, fetchOptions);
    } catch (fetchError) {
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy (node-fetch)',
            ...options.headers,
          },
          ...(options.body && { body: options.body }),
          agent: function(_parsedURL: any) {
            const https = require('https');
            return new https.Agent({
              rejectUnauthorized: false
            });
          }
        });
      } else {
        throw fetchError;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } finally {
    // 환경 변수 복원
    if (originalTlsReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
  }
}

// 인증 헬퍼 함수
function getAuthHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return {
    'Authorization': `Bearer ${token}`
  };
}

export async function GET(req: NextRequest) {
  try {
    console.log('[Schedule API] 그룹 스케줄 조회 요청 시작');
    
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    console.log('[Schedule API] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
    
    const user = token ? verifyJWT(token) : null;
    console.log('[Schedule API] 사용자 인증:', user ? `사용자 ID: ${user.mt_idx}` : '인증 실패');
    
    if (!user) {
      console.log('[Schedule API] 인증 실패 - 401 반환');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const memberId = searchParams.get('memberId');

    console.log('[Schedule API] 요청 파라미터:', { groupId, startDate, endDate, memberId });

    if (!groupId) {
      console.log('[Schedule API] groupId 누락 - 400 반환');
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    // 백엔드 API URL 구성
    const backendUrl = new URL(`http://118.67.130.71:8000/api/v1/group-schedule-manage/group/${groupId}/schedules`);
    
    // 쿼리 파라미터 추가
    backendUrl.searchParams.set('current_user_id', user.mt_idx.toString());
    if (startDate) backendUrl.searchParams.set('start_date', startDate);
    if (endDate) backendUrl.searchParams.set('end_date', endDate);
    if (memberId) backendUrl.searchParams.set('member_id', memberId);

    console.log('[Schedule API] 백엔드 API 호출:', backendUrl.toString());

    // 백엔드 API 호출
    const backendResponse = await fetchWithFallback(backendUrl.toString(), {
      method: 'GET',
      headers: getAuthHeaders(token)
    });

    console.log('[Schedule API] 백엔드 응답 성공:', {
      success: backendResponse.success,
      schedulesCount: backendResponse.data?.schedules?.length || 0,
      groupMembersCount: backendResponse.data?.groupMembers?.length || 0
    });

    return NextResponse.json(backendResponse, {
      headers: {
        'X-Data-Source': 'backend-proxy',
        'X-Backend-URL': backendUrl.toString()
      }
    });

  } catch (error) {
    console.error('[Schedule API] 백엔드 호출 오류:', error);
    
    // 목업 데이터 반환
    const mockResponse = {
      success: true,
      data: {
        schedules: [
          {
            sst_idx: 1,
            sst_title: '목업 일정 1',
            sst_sdate: '2024-12-25 09:00:00',
            sst_edate: '2024-12-25 10:00:00',
            sst_all_day: 'N',
            sst_memo: '목업 일정 내용',
            mt_idx: 1186,
            member_name: 'jin',
            member_photo: 'jin.png'
          },
          {
            sst_idx: 2,
            sst_title: '목업 일정 2',
            sst_sdate: '2024-12-26 14:00:00',
            sst_edate: '2024-12-26 15:00:00',
            sst_all_day: 'N',
            sst_memo: '목업 일정 내용 2',
            mt_idx: 282,
            member_name: 'yeon',
            member_photo: 'yeon.png'
          }
        ],
        groupMembers: [
          {
            mt_idx: 1186,
            mt_name: 'jin',
            mt_file1: 'jin.png',
            sgdt_idx: 1,
            sgdt_owner_chk: 'Y',
            sgdt_leader_chk: 'N'
          },
          {
            mt_idx: 282,
            mt_name: 'yeon',
            mt_file1: 'yeon.png',
            sgdt_idx: 2,
            sgdt_owner_chk: 'N',
            sgdt_leader_chk: 'Y'
          }
        ],
        userPermission: {
          canManage: true,
          isOwner: true,
          isLeader: false
        }
      }
    };

    console.log('[Schedule API] 목업 데이터 반환');
    return NextResponse.json(mockResponse, {
      headers: {
        'X-Data-Source': 'mock-fallback',
        'X-Error': error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[Schedule API] 스케줄 생성 요청 시작');
    
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = token ? verifyJWT(token) : null;
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[Schedule API] 요청 본문:', body);

    const { groupId } = body;
    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    // 백엔드 API URL
    const backendUrl = `http://118.67.130.71:8000/api/v1/group-schedule-manage/group/${groupId}/schedules`;
    
    // current_user_id를 쿼리 파라미터로 추가
    const urlWithParams = new URL(backendUrl);
    urlWithParams.searchParams.set('current_user_id', user.mt_idx.toString());

    console.log('[Schedule API] 백엔드 API 호출:', urlWithParams.toString());

    // 백엔드 API 호출
    const backendResponse = await fetchWithFallback(urlWithParams.toString(), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(body)
    });

    console.log('[Schedule API] 백엔드 생성 응답:', backendResponse);

    return NextResponse.json(backendResponse);

  } catch (error) {
    console.error('[Schedule API] 스케줄 생성 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    console.log('[Schedule API] 스케줄 수정 요청 시작');
    
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = token ? verifyJWT(token) : null;
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[Schedule API] 수정 요청 본문:', body);

    const { sst_idx, groupId } = body;
    if (!sst_idx || !groupId) {
      return NextResponse.json({ error: 'sst_idx and groupId are required' }, { status: 400 });
    }

    // 백엔드 API URL
    const backendUrl = `http://118.67.130.71:8000/api/v1/group-schedule-manage/group/${groupId}/schedules/${sst_idx}`;
    
    // current_user_id를 쿼리 파라미터로 추가
    const urlWithParams = new URL(backendUrl);
    urlWithParams.searchParams.set('current_user_id', user.mt_idx.toString());

    console.log('[Schedule API] 백엔드 API 호출:', urlWithParams.toString());

    // 백엔드 API 호출
    const backendResponse = await fetchWithFallback(urlWithParams.toString(), {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(body)
    });

    console.log('[Schedule API] 백엔드 수정 응답:', backendResponse);

    return NextResponse.json(backendResponse);

  } catch (error) {
    console.error('[Schedule API] 스케줄 수정 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    console.log('[Schedule API] 스케줄 삭제 요청 시작');
    
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = token ? verifyJWT(token) : null;
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sst_idx = searchParams.get('sst_idx');
    const groupId = searchParams.get('groupId');

    console.log('[Schedule API] 삭제 요청 파라미터:', { sst_idx, groupId });

    if (!sst_idx || !groupId) {
      return NextResponse.json({ error: 'sst_idx and groupId are required' }, { status: 400 });
    }

    // 백엔드 API URL
    const backendUrl = `http://118.67.130.71:8000/api/v1/group-schedule-manage/group/${groupId}/schedules/${sst_idx}`;
    
    // current_user_id를 쿼리 파라미터로 추가
    const urlWithParams = new URL(backendUrl);
    urlWithParams.searchParams.set('current_user_id', user.mt_idx.toString());

    console.log('[Schedule API] 백엔드 API 호출:', urlWithParams.toString());

    // 백엔드 API 호출
    const backendResponse = await fetchWithFallback(urlWithParams.toString(), {
      method: 'DELETE',
      headers: getAuthHeaders(token)
    });

    console.log('[Schedule API] 백엔드 삭제 응답:', backendResponse);

    return NextResponse.json(backendResponse);

  } catch (error) {
    console.error('[Schedule API] 스케줄 삭제 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
} 