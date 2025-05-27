import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const { memberId } = await params; // Next.js 15에서 params를 await해야 함
  try {
    // 다른 API와 동일하게 HTTPS 사용
    const backendUrl = `https://118.67.130.71:8000/api/v1/locations/member/${memberId}`;
    
    console.log('[API PROXY] 다른 멤버 위치 백엔드 호출:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      // @ts-ignore - Node.js fetch에서 SSL 인증서 검증 비활성화
      rejectUnauthorized: false,
    });

    console.log('[API PROXY] 다른 멤버 위치 백엔드 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY] 다른 멤버 위치 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : [];
    
    console.log('[API PROXY] 다른 멤버 위치 백엔드 응답 성공, 데이터 길이:', Array.isArray(data) ? data.length : 'object');

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY] 다른 멤버 위치 상세 오류:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code || 'UNKNOWN',
      cause: (error as any)?.cause || null,
    });
    
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error fetching other member locations' }, 
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 