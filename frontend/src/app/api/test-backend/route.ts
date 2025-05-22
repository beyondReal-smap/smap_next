import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const testUrls = [
    'https://118.67.130.71:8000/api/v1/group-members/member/641',
    'https://118.67.130.71:8000/api/v1/schedules/group/641'
  ];

  const results = [];

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
      });

      console.log('[TEST] 응답 상태:', response.status, response.statusText);
      
      const data = response.ok ? await response.json() : await response.text();
      
      results.push({
        url,
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        data: response.ok ? data : `Error: ${data}`,
        headers: Object.fromEntries(response.headers.entries())
      });
    } catch (error) {
      console.error('[TEST] 에러:', error);
      results.push({
        url,
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results
  });
} 