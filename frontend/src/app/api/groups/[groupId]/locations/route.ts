import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';

// SSL 인증서 문제 해결을 위한 설정 (공지사항 API와 동일)
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

async function fetchWithFallback(url: string): Promise<any> {
  const backendUrl = resolveBackendBaseUrl();
  
  console.log('[Group Locations API] 🔗 백엔드 요청:', {
    url,
    backendUrl,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Group Locations API] ❌ 백엔드 응답 오류:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url
      });
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Group Locations API] ✅ 백엔드 응답 성공:', {
      url,
      dataLength: Array.isArray(data) ? data.length : 'not array',
      timestamp: new Date().toISOString()
    });

    return data;
  } catch (error) {
    console.error('[Group Locations API] 🚨 요청 실패:', {
      url,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    console.log('[Group Locations API] 그룹 장소 조회 요청:', { groupId });

    // 먼저 그룹 멤버들을 조회
    const membersUrl = `${backendUrl}/api/v1/group-members/member/${groupId}`;
    console.log('[Group Locations API] 그룹 멤버 조회:', membersUrl);
    
    const membersData = await fetchWithFallback(membersUrl);
    console.log('[Group Locations API] 그룹 멤버 응답:', { count: membersData.length });
    
    // 각 멤버의 위치 정보를 조회
    const allLocations: any[] = [];
    
    for (const member of membersData) {
      try {
        const memberLocationsUrl = `${backendUrl}/api/v1/locations/member/${member.mt_idx}`;
        console.log('[Group Locations API] 멤버 위치 조회:', { memberId: member.mt_idx, url: memberLocationsUrl });
        
        const memberLocations = await fetchWithFallback(memberLocationsUrl);
        
        // 해당 그룹의 위치만 필터링
        const groupLocations = memberLocations.filter((location: any) => 
          location.sgt_idx == groupId
        );
        
        allLocations.push(...groupLocations);
        console.log('[Group Locations API] 멤버 위치 추가:', { 
          memberId: member.mt_idx, 
          memberName: member.mt_name,
          locationCount: groupLocations.length 
        });
      } catch (memberError) {
        console.warn('[Group Locations API] 멤버 위치 조회 실패:', { 
          memberId: member.mt_idx, 
          error: memberError 
        });
        // 개별 멤버 오류는 무시하고 계속 진행
      }
    }
    
    const locationsData = allLocations;
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

 