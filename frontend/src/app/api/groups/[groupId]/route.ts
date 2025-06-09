import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUserId } from '@/lib/auth';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Group API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string, options: RequestInit): Promise<any> {
  // Node.js 환경 변수로 SSL 검증 비활성화
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  let response: any;

  try {
    try {
      // 기본 fetch 시도
      response = await fetch(url, options);
    } catch (fetchError) {
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
          ...options,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    console.log('[Group Get API] 그룹 정보 조회 요청:', { groupId });

    // 백엔드 그룹 조회 API 호출
    const backendUrl = `https://118.67.130.71:8000/api/v1/groups/${groupId}`;
    console.log('[Group Get API] 백엔드 API 호출:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
      rejectUnauthorized: false,
    };
    
    const data = await fetchWithFallback(backendUrl, fetchOptions);
    console.log('[Group Get API] 백엔드 응답 성공:', data);
    
    // 백엔드에서 받은 데이터를 Group 형태로 변환
    const groupData = {
      sgt_idx: data.sgt_idx,
      sgt_title: data.sgt_title,
      sgt_content: data.sgt_content || data.sgt_memo,
      sgt_memo: data.sgt_memo,
      mt_idx: data.mt_idx,
      sgt_show: data.sgt_show,
      sgt_wdate: data.sgt_wdate,
      memberCount: 0 // 기본값, 멤버 수는 별도 API에서 조회
    };
    
    return NextResponse.json(groupData);

  } catch (error) {
    console.error('[Group Get API] 오류:', error);
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '그룹 정보 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500 
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    const body = await request.json();
    console.log('[Group Update API] 그룹 업데이트 요청:', { groupId, body });

    // 백엔드 그룹 업데이트 API 호출
    const backendUrl = `https://118.67.130.71:8000/api/v1/groups/${groupId}`;
    console.log('[Group Update API] 백엔드 API 호출:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(body),
      // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
      rejectUnauthorized: false,
    };
    
    const data = await fetchWithFallback(backendUrl, fetchOptions);
    console.log('[Group Update API] 백엔드 응답 성공:', data);
    
    // 백엔드에서 받은 데이터를 Group 형태로 변환
    const groupData = {
      sgt_idx: data.sgt_idx,
      sgt_title: data.sgt_title,
      sgt_content: data.sgt_content || data.sgt_memo,
      sgt_memo: data.sgt_memo,
      mt_idx: data.mt_idx,
      sgt_show: data.sgt_show,
      sgt_wdate: data.sgt_wdate,
      memberCount: 0 // 기본값
    };
    
    return NextResponse.json({
      success: true,
      data: groupData,
      message: '그룹이 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('[Group Update API] 오류:', error);
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '그룹 업데이트 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500 
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    console.log('[Group Delete API] 그룹 소프트 삭제 요청:', { groupId });
    console.log('[Group Delete API] ⚠️ 중요: 실제 삭제가 아닌 sgt_show=N 업데이트 실행');

    // 소프트 삭제를 위한 PUT 요청으로 sgt_show를 'N'으로 업데이트
    const updateData = {
      sgt_show: 'N'
    };

    const backendUrl = `https://118.67.130.71:8000/api/v1/groups/${groupId}`;
    console.log('[Group Delete API] 백엔드 PUT API 호출 (소프트 삭제):', backendUrl);
    console.log('[Group Delete API] 전송할 데이터:', updateData);
    
    const fetchOptions: RequestInit = {
      method: 'PUT', // DELETE 대신 PUT 사용
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(updateData), // sgt_show: 'N' 전송
      // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
      rejectUnauthorized: false,
    };
    
    const data = await fetchWithFallback(backendUrl, fetchOptions);
    console.log('[Group Delete API] 백엔드 응답 성공 (소프트 삭제):', data);
    console.log('[Group Delete API] ✅ 소프트 삭제 완료 - 실제 DB 삭제 아님');
    
    // 백엔드에서 받은 데이터를 Group 형태로 변환
    const groupData = {
      sgt_idx: data.sgt_idx,
      sgt_title: data.sgt_title,
      sgt_content: data.sgt_content || data.sgt_memo,
      sgt_memo: data.sgt_memo,
      mt_idx: data.mt_idx,
      sgt_show: data.sgt_show, // 'N'이 되어야 함
      sgt_wdate: data.sgt_wdate,
      memberCount: 0 // 기본값
    };
    
    return NextResponse.json({
      success: true,
      data: groupData,
      message: '그룹이 목록에서 숨겨졌습니다. (소프트 삭제)'
    });

  } catch (error) {
    console.error('[Group Delete API] 소프트 삭제 오류:', error);
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '그룹 삭제 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500 
    });
  }
} 