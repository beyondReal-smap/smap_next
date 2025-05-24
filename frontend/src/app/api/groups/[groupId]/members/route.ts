import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Group Members API] node-fetch 패키지를 찾을 수 없음');
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
    console.log('[Group Members API] 그룹 멤버 조회 요청:', { groupId });

    // 새로운 통합 엔드포인트 호출 (member_t + smap_group_detail_t 조인된 데이터)
    const membersWithDetailsUrl = `https://118.67.130.71:8000/api/v1/groups/${groupId}/members-with-details`;
    console.log('[Group Members API] 통합 멤버 정보 조회:', membersWithDetailsUrl);
    
    let combinedData;
    try {
      combinedData = await fetchWithFallback(membersWithDetailsUrl);
      console.log('[Group Members API] 통합 멤버 정보 조회 성공:', { 
        count: combinedData.length, 
        sampleMember: combinedData[0] ? {
          name: combinedData[0].mt_name,
          owner: combinedData[0].sgdt_owner_chk,
          leader: combinedData[0].sgdt_leader_chk
        } : null
      });
      
      // null 값을 기본값으로 변환
      const processedData = combinedData.map((member: any) => ({
        ...member,
        sgdt_discharge_chk: member.sgdt_discharge_chk || "N",
        sgdt_exit_chk: member.sgdt_exit_chk || "N",
        sgdt_in_chk: member.sgdt_in_chk || "Y",
        sgdt_schedule_chk: member.sgdt_schedule_chk || "Y", 
        sgdt_read_chk: member.sgdt_read_chk || "Y",
        sgdt_enter_alarm: member.sgdt_enter_alarm || "Y",
        sgdt_enter_chk: member.sgdt_enter_chk || "Y",
        sgdt_wdate: member.sgdt_wdate || new Date().toISOString(),
        sgdt_udate: member.sgdt_udate || new Date().toISOString()
      }));
      
      return NextResponse.json(processedData, {
        headers: {
          'X-Data-Source': 'backend-unified',
          'X-Members-Count': processedData.length.toString()
        }
      });
      
    } catch (unifiedError) {
      console.error('[Group Members API] 통합 엔드포인트 호출 실패, 기존 방식으로 fallback:', unifiedError);
      
      // 기존 방식으로 fallback
      // 1. 멤버 기본 정보 조회
      const membersUrl = `https://118.67.130.71:8000/api/v1/group-members/member/${groupId}`;
      console.log('[Group Members API] 멤버 기본 정보 조회 (fallback):', membersUrl);
      
      let membersData;
      try {
        membersData = await fetchWithFallback(membersUrl);
        console.log('[Group Members API] 멤버 기본 정보 조회 성공:', { count: membersData.length, first: membersData[0]?.mt_name });
      } catch (membersError) {
        console.error('[Group Members API] 멤버 기본 정보 조회 실패:', membersError);
        throw membersError;
      }

      // 2. 그룹 상세 정보 조회
      const groupDetailsUrl = `https://118.67.130.71:8000/api/v1/group-details/group/${groupId}/members`;
      console.log('[Group Members API] 그룹 상세 정보 조회:', groupDetailsUrl);
      
      let groupDetailsData;
      try {
        groupDetailsData = await fetchWithFallback(groupDetailsUrl);
        console.log('[Group Members API] 그룹 상세 정보 조회 성공:', { count: groupDetailsData.length, details: groupDetailsData });
      } catch (groupDetailsError) {
        console.error('[Group Members API] 그룹 상세 정보 조회 실패:', groupDetailsError);
        throw groupDetailsError;
      }

      // 3. 데이터 조합 (mt_idx 기준으로 조인)
      const combinedDataFallback = membersData.map((member: any) => {
        const groupDetail = groupDetailsData.find((detail: any) => detail.mt_idx === member.mt_idx);
        
        // 그룹 상세 정보가 없는 경우 기본값 설정
        const defaultGroupDetail = {
          sgt_idx: parseInt(groupId),
          sgdt_idx: null,
          sgdt_owner_chk: "N",
          sgdt_leader_chk: "N", 
          sgdt_discharge_chk: "N",
          sgdt_group_chk: "Y",
          sgdt_exit_chk: "N",
          sgdt_push_chk: "Y",
          sgdt_in_chk: "Y",
          sgdt_schedule_chk: "Y",
          sgdt_read_chk: "Y",
          sgdt_enter_alarm: "Y",
          sgdt_enter_chk: "Y",
          sgdt_wdate: new Date().toISOString(),
          sgdt_udate: new Date().toISOString()
        };
        
        // null 값을 기본값으로 변환하는 함수
        const processGroupDetail = (detail: any) => {
          if (!detail) return defaultGroupDetail;
          
          return {
            ...detail,
            sgdt_discharge_chk: detail.sgdt_discharge_chk || "N",
            sgdt_exit_chk: detail.sgdt_exit_chk || "N",
            sgdt_in_chk: detail.sgdt_in_chk || "Y", 
            sgdt_schedule_chk: detail.sgdt_schedule_chk || "Y",
            sgdt_read_chk: detail.sgdt_read_chk || "Y",
            sgdt_enter_alarm: detail.sgdt_enter_alarm || "Y",
            sgdt_enter_chk: detail.sgdt_enter_chk || "Y",
            sgdt_wdate: detail.sgdt_wdate || new Date().toISOString(),
            sgdt_udate: detail.sgdt_udate || new Date().toISOString()
          };
        };
        
        return {
          ...member,
          ...processGroupDetail(groupDetail)
        };
      });

      console.log('[Group Members API] 조합된 데이터:', {
        membersCount: membersData.length,
        groupDetailsCount: groupDetailsData.length,
        combinedCount: combinedDataFallback.length,
        sampleMember: combinedDataFallback[0] ? Object.keys(combinedDataFallback[0]) : []
      });

      return NextResponse.json(combinedDataFallback, {
        headers: {
          'X-Data-Source': 'backend-fallback',
          'X-Members-Count': membersData.length.toString(),
          'X-Group-Details-Count': groupDetailsData.length.toString()
        }
      });
    }

  } catch (error) {
    console.error('[Group Members API] 오류:', error);
    
    // 목업 데이터 반환 (완전한 필드 포함)
    console.error('[Group Members API] 백엔드 호출 실패, 목업 데이터 반환');
    const mockData = [
      {
        // yeon - 실제 백엔드 데이터와 동일
        mt_type: 1,
        mt_level: 2,
        mt_status: 1,
        mt_id: "01021655435",
        mt_name: "yeon",
        mt_nickname: "yeon",
        mt_hp: "01021655435",
        mt_email: "h@b.com",
        mt_show: "Y",
        mt_lang: "ko",
        mt_lat: 37.51872,
        mt_long: 126.88486,
        mt_sido: "서울특별시",
        mt_gu: "영등포구",
        mt_dong: "문래동",
        mt_file1: "yeon.png",
        mt_idx: 282,
        mt_gender: 2,
        mt_weather_pop: 30,
        mt_weather_tmn: 14,
        mt_weather_tmx: 22,
        mt_weather_sky: 8,
        mt_weather_date: "2025-05-24T16:43:17",
        mt_wdate: "2024-05-24T01:17:50",
        mt_ldate: "2025-05-18T08:25:21",
        mt_udate: "2025-05-24T21:09:19",
        
        // 실제 그룹 상세 정보 (백엔드와 동일)
        sgt_idx: parseInt(groupId),
        sgdt_idx: 991,
        sgdt_owner_chk: "N",
        sgdt_leader_chk: "N",
        sgdt_discharge_chk: "N",
        sgdt_group_chk: "Y",
        sgdt_exit_chk: "N",
        sgdt_push_chk: "Y"
      },
      {
        // jin - 그룹 상세 정보 없음 (실제 백엔드 상황과 동일)
        mt_type: 1,
        mt_level: 5,
        mt_status: 1,
        mt_id: "01029565435",
        mt_name: "jin",
        mt_nickname: "jin",
        mt_hp: "01029565435",
        mt_email: "bluemusk@gmail.com",
        mt_show: "Y",
        mt_lang: "ko",
        mt_lat: 37.51862,
        mt_long: 126.88452,
        mt_sido: "서울특별시",
        mt_gu: "영등포구",
        mt_dong: "문래동",
        mt_file1: "jin.png",
        mt_idx: 1186,
        mt_gender: 1,
        mt_weather_pop: 30,
        mt_weather_tmn: 14,
        mt_weather_tmx: 22,
        mt_weather_sky: 8,
        mt_weather_date: "2025-05-24T20:23:45",
        mt_wdate: "2024-10-11T17:41:42",
        mt_ldate: "2025-05-17T14:08:32",
        mt_udate: "2025-05-24T22:44:13",
        
        // 기본값 (그룹 상세 정보 없음)
        sgt_idx: parseInt(groupId),
        sgdt_idx: null,
        sgdt_owner_chk: "N",
        sgdt_leader_chk: "N",
        sgdt_discharge_chk: "N",
        sgdt_group_chk: "Y",
        sgdt_exit_chk: "N",
        sgdt_push_chk: "Y"
      },
      {
        // sil - 그룹 상세 정보 없음 (실제 백엔드 상황과 동일)
        mt_type: 1,
        mt_level: 5,
        mt_status: 1,
        mt_id: "01027169725",
        mt_name: "sil",
        mt_nickname: "siri",
        mt_hp: "01027169725",
        mt_email: "",
        mt_show: "Y",
        mt_lang: "ko",
        mt_lat: 37.52876,
        mt_long: 126.87536,
        mt_sido: "서울특별시",
        mt_gu: "양천구",
        mt_dong: "목1동",
        mt_file1: "sil.png",
        mt_idx: 1194,
        mt_gender: 2,
        mt_weather_pop: 30,
        mt_weather_tmn: 9,
        mt_weather_tmx: 20,
        mt_weather_sky: 8,
        mt_weather_date: "2025-05-06T17:50:18",
        mt_wdate: "2024-10-12T00:50:37",
        mt_ldate: "2025-02-28T17:57:30",
        mt_udate: "2025-05-24T19:40:04",
        
        // 기본값 (그룹 상세 정보 없음)
        sgt_idx: parseInt(groupId),
        sgdt_idx: null,
        sgdt_owner_chk: "N",
        sgdt_leader_chk: "N",
        sgdt_discharge_chk: "N",
        sgdt_group_chk: "Y",
        sgdt_exit_chk: "N",
        sgdt_push_chk: "Y"
      },
      {
        // eun - 실제 백엔드 데이터와 동일
        mt_type: 1,
        mt_level: 2,
        mt_status: 1,
        mt_id: "",
        mt_name: "eun",
        mt_nickname: "eun",
        mt_hp: "",
        mt_email: "blue@gmail.com",
        mt_show: "Y",
        mt_lang: "id",
        mt_lat: 37.5666805,
        mt_long: 126.9784147,
        mt_sido: "서울특별시",
        mt_gu: "중구",
        mt_dong: "명동",
        mt_file1: "eun.png",
        mt_idx: 1200,
        mt_gender: 1,
        mt_weather_pop: 0,
        mt_weather_tmn: 3,
        mt_weather_tmx: 14,
        mt_weather_sky: 8,
        mt_weather_date: "2025-03-13T08:18:35",
        mt_wdate: "2024-10-12T20:32:46",
        mt_ldate: "2024-10-12T22:49:27",
        mt_udate: "2025-05-24T19:40:05",
        
        // 실제 그룹 상세 정보 (백엔드와 동일)
        sgt_idx: parseInt(groupId),
        sgdt_idx: 995,
        sgdt_owner_chk: "N",
        sgdt_leader_chk: "N",
        sgdt_discharge_chk: "N",
        sgdt_group_chk: "Y",
        sgdt_exit_chk: "N",
        sgdt_push_chk: "Y"
      }
    ];

    return NextResponse.json(mockData, { 
      status: 200,
      headers: {
        'X-Data-Source': 'mock',
        'X-Members-Count': mockData.length.toString()
      }
    });
  }
} 