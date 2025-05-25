import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Group Update API] node-fetch 패키지를 찾을 수 없음');
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
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