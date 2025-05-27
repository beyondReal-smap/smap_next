import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Group Locations API] node-fetch 패키지를 찾을 수 없음');
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
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    console.log('[Group Locations API] 그룹 장소 조회 요청:', { groupId });

    // 백엔드 엔드포인트 직접 호출
    const locationsUrl = `https://118.67.130.71:8000/api/v1/locations/group/${groupId}`;
    console.log('[Group Locations API] 백엔드 API 호출:', locationsUrl);
    
    const locationsData = await fetchWithFallback(locationsUrl);
    console.log('[Group Locations API] 백엔드 응답 성공:', { 
      count: locationsData.length, 
      sampleLocation: locationsData[0] ? {
        title: locationsData[0].slt_title,
        address: locationsData[0].slt_add,
        show: locationsData[0].slt_show
      } : null
    });
    
    // null 값을 기본값으로 변환
    const processedData = locationsData.map((location: any) => ({
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
        'X-Locations-Count': processedData.length.toString()
      }
    });

  } catch (error) {
    console.error('[Group Locations API] 오류:', error);
    
    // 목업 데이터 반환 (DB 스키마에 맞는 완전한 필드 포함)
    console.error('[Group Locations API] 백엔드 호출 실패, 목업 데이터 반환');
    const mockData = [
      {
        slt_idx: 1001,
        insert_mt_idx: 282,
        mt_idx: 282,
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
        insert_mt_idx: 282,
        mt_idx: 1186,
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
      },
      {
        slt_idx: 1003,
        insert_mt_idx: 1194,
        mt_idx: 1194,
        sgt_idx: parseInt(groupId),
        sgdt_idx: null,
        slt_title: "카페",
        slt_add: "서울특별시 홍대입구역 근처 카페거리 789",
        slt_lat: 37.5563,
        slt_long: 126.9226,
        slt_show: "Y",
        slt_enter_chk: "N",
        slt_enter_alarm: "N",
        slt_wdate: "2024-10-03T14:15:00",
        slt_udate: "2024-10-03T14:15:00",
        slt_ddate: null
      },
      {
        slt_idx: 1004,
        insert_mt_idx: 1200,
        mt_idx: 1200,
        sgt_idx: parseInt(groupId),
        sgdt_idx: 995,
        slt_title: "병원",
        slt_add: "서울특별시 중구 명동길 101",
        slt_lat: 37.5636,
        slt_long: 126.9834,
        slt_show: "Y",
        slt_enter_chk: "N",
        slt_enter_alarm: "Y",
        slt_wdate: "2024-10-04T11:20:00",
        slt_udate: "2024-10-04T11:20:00",
        slt_ddate: null
      }
    ];

    return NextResponse.json(mockData, { 
      status: 200,
      headers: {
        'X-Data-Source': 'mock',
        'X-Locations-Count': mockData.length.toString()
      }
    });
  }
}

 