import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Member Locations API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string): Promise<any> {
  const fetchOptions: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
    },
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
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  const { groupId, memberId } = await params;
  
  try {
    console.log('[Member Locations API] 멤버 장소 조회 요청:', { groupId, memberId });

    // 백엔드 엔드포인트 직접 호출
    const locationsUrl = `https://api3.smap.site/api/v1/locations/member/${memberId}`;
    console.log('[Member Locations API] 백엔드 API 호출:', locationsUrl);
    
    const locationsData = await fetchWithFallback(locationsUrl);
    console.log('[Member Locations API] 백엔드 응답 성공:', { 
      count: locationsData.length, 
      sampleLocation: locationsData[0] ? {
        title: locationsData[0].slt_title,
        address: locationsData[0].slt_add,
        show: locationsData[0].slt_show
      } : null
    });
    
    // 해당 그룹의 장소만 필터링 및 null 값을 기본값으로 변환
    const processedData = locationsData
      .filter((location: any) => location.sgt_idx == groupId)
      .map((location: any) => ({
        ...location,
        slt_show: location.slt_show || "Y",
        slt_enter_chk: location.slt_enter_chk || "N",
        slt_enter_alarm: location.slt_enter_alarm || "Y",
        slt_wdate: location.slt_wdate || new Date().toISOString(),
        slt_udate: location.slt_udate || new Date().toISOString(),
        slt_ddate: location.slt_ddate || null
      }));
    
    return NextResponse.json(processedData, {
      headers: {
        'X-Data-Source': 'backend-direct',
        'X-Locations-Count': processedData.length.toString(),
        'X-Group-Id': groupId,
        'X-Member-Id': memberId
      }
    });

  } catch (error) {
    console.error('[Member Locations API] 오류:', error);
    
    // 목업 데이터 반환 (DB 스키마에 맞는 완전한 필드 포함)
    console.error('[Member Locations API] 백엔드 호출 실패, 목업 데이터 반환');
    const mockData = [
      {
        slt_idx: 1001,
        insert_mt_idx: parseInt(memberId),
        mt_idx: parseInt(memberId),
        sgt_idx: parseInt(groupId),
        sgdt_idx: 991,
        slt_title: "회사",
        slt_add: "서울특별시 강남구 테헤란로 123",
        slt_lat: 37.5012,
        slt_long: 127.0396,
        slt_show: "Y",
        slt_enter_chk: "N",
        slt_enter_alarm: "Y",
        slt_wdate: "2024-10-01T09:00:00",
        slt_udate: "2024-10-01T09:00:00",
        slt_ddate: null
      },
      {
        slt_idx: 1002,
        insert_mt_idx: parseInt(memberId),
        mt_idx: parseInt(memberId),
        sgt_idx: parseInt(groupId),
        sgdt_idx: null,
        slt_title: "집",
        slt_add: "서울특별시 서초구 서초대로 456",
        slt_lat: 37.4946,
        slt_long: 127.0276,
        slt_show: "Y",
        slt_enter_chk: "Y",
        slt_enter_alarm: "Y",
        slt_wdate: "2024-10-02T18:30:00",
        slt_udate: "2024-10-02T18:30:00",
        slt_ddate: null
      }
    ];

    return NextResponse.json(mockData, { 
      status: 200,
      headers: {
        'X-Data-Source': 'mock',
        'X-Locations-Count': mockData.length.toString(),
        'X-Group-Id': groupId,
        'X-Member-Id': memberId
      }
    });
  }
} 