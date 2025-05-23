import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const testUrls = [
    'https://118.67.130.71:8000/api/v1/group-members/member/641',
    'https://118.67.130.71:8000/api/v1/schedules/group/641',
    'https://118.67.130.71:8000/api/v1/locations/member/282'
  ];

  const results = [];

  // Node.js 환경 변수로 SSL 검증 비활성화 (테스트용)
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  for (const url of testUrls) {
    try {
      console.log('[TEST] 백엔드 테스트:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Next.js Test',
        },
        // @ts-ignore - SSL 인증서 검증 우회
        rejectUnauthorized: false,
      });

      console.log('[TEST] 응답 상태:', response.status, response.statusText);
      
      const responseHeaders = Object.fromEntries(response.headers.entries());
      const isJson = response.headers.get('content-type')?.includes('application/json');
      
      let data;
      let dataPreview;
      
      if (response.ok) {
        if (isJson) {
          data = await response.json();
          dataPreview = Array.isArray(data) 
            ? `배열 ${data.length}개 항목` 
            : `객체 ${Object.keys(data).length}개 속성`;
        } else {
          data = await response.text();
          dataPreview = `텍스트 ${data.length}자`;
        }
      } else {
        data = await response.text();
        dataPreview = `에러 응답: ${data.substring(0, 100)}...`;
      }
      
      results.push({
        url,
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        dataPreview,
        headers: responseHeaders,
        sslBypass: 'enabled',
        // 데이터가 너무 클 수 있으므로 전체 데이터는 성공시에만 포함
        ...(response.ok && isJson && Array.isArray(data) && data.length <= 10 ? { sampleData: data } : {}),
        ...(response.ok && isJson && !Array.isArray(data) ? { sampleData: data } : {}),
        ...(!response.ok ? { errorData: data } : {})
      });
    } catch (error) {
      console.error('[TEST] 에러:', error);
      
      const errorDetails = {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code || 'UNKNOWN',
        cause: (error as any)?.cause || null,
      };
      
      results.push({
        url,
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
        errorDetails,
        sslBypass: 'enabled'
      });
    }
  }

  // 환경 변수 복원
  if (originalTlsReject !== undefined) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
  } else {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      vercel: !!process.env.VERCEL,
      region: process.env.VERCEL_REGION || 'unknown',
    },
    results
  });
} 