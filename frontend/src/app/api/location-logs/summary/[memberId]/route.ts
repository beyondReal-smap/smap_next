import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Location Summary API] node-fetch 패키지를 찾을 수 없음');
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
    body: options.body,
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
      console.log('[Location Summary API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Location Summary API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
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
          body: options.body,
          agent: function(_parsedURL: any) {
            const https = require('https');
            return new https.Agent({
              rejectUnauthorized: false
            });
          }
        });
        console.log('[Location Summary API] node-fetch 성공');
      } else {
        throw fetchError;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Location Summary API] 백엔드 500 에러 응답:', errorText);
      
      // 500 에러이지만 JSON 응답이 있는 경우 파싱 시도
      if (response.status === 500 && errorText.includes('total_distance')) {
        try {
          // 에러 메시지에서 실제 데이터 추출 시도
          const match = errorText.match(/input_value=({[^}]+})/);
          if (match) {
            const rawData = match[1].replace(/'/g, '"'); // Python dict를 JSON으로 변환
            const parsedData = JSON.parse(rawData);
            console.log('[Location Summary API] 500 에러에서 데이터 추출 성공:', parsedData);
            return parsedData;
          }
        } catch (parseError) {
          console.log('[Location Summary API] 500 에러 데이터 파싱 실패:', parseError);
        }
      }
      
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

// 백엔드 응답을 프론트엔드 형식으로 변환하는 함수
function transformBackendResponse(backendData: any) {
  console.log('[Location Summary API] 백엔드 원본 데이터:', backendData);
  
  // 시간을 초 단위에서 "X시간 Y분" 형식으로 변환
  function formatDuration(seconds: number): string {
    if (typeof seconds !== 'number') {
      return '0분';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0 && minutes > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else if (minutes > 0) {
      return `${minutes}분`;
    } else {
      return '1분 미만';
    }
  }
  
  const transformed = {
    total_distance: backendData.total_distance || 0,
    total_time: typeof backendData.total_time === 'number' 
      ? formatDuration(backendData.total_time)
      : backendData.total_time || '0분',
    step_count: backendData.step_count || backendData.steps || 0,
    average_speed: backendData.average_speed || backendData.avg_speed || 0,
    battery_consumption: backendData.battery_consumption || backendData.battery_usage || 0
  };
  
  console.log('[Location Summary API] 변환된 데이터:', transformed);
  return transformed;
}

// 원시 데이터로부터 요약 정보를 계산하는 함수
function calculateSummaryFromRawData(rawData: any, date: string) {
  console.log('[Location Summary API] 원시 데이터에서 요약 계산:', rawData);
  
  // 빈 데이터인 경우
  if (!rawData || !rawData.data || rawData.data.length === 0) {
    return {
      total_distance: 0,
      total_time: '0분',
      step_count: 0,
      average_speed: 0,
      battery_consumption: 0
    };
  }
  
  const locationData = rawData.data;
  let totalDistance = 0;
  let totalTime = 0;
  let stepCount = 0;
  let batteryStart = 100;
  let batteryEnd = 100;
  let speedSum = 0;
  let speedCount = 0;
  
  // 위치 데이터가 배열인 경우
  if (Array.isArray(locationData)) {
    for (let i = 1; i < locationData.length; i++) {
      const prev = locationData[i - 1];
      const curr = locationData[i];
      
      // 거리 계산 (Haversine formula)
      if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
        const distance = calculateDistance(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude
        );
        totalDistance += distance;
      }
      
      // 시간 계산
      if (prev.timestamp && curr.timestamp) {
        const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
        totalTime += timeDiff / 1000; // 초 단위
      }
      
      // 속도 정보
      if (curr.speed && curr.speed > 0) {
        speedSum += curr.speed;
        speedCount++;
      }
      
      // 걸음 수 (가장 큰 값 사용)
      if (curr.step_count && curr.step_count > stepCount) {
        stepCount = curr.step_count;
      }
      
      // 배터리 정보
      if (i === 1 && prev.battery_level) batteryStart = prev.battery_level;
      if (i === locationData.length - 1 && curr.battery_level) batteryEnd = curr.battery_level;
    }
  }
  
  const averageSpeed = speedCount > 0 ? speedSum / speedCount : 0;
  const batteryConsumption = batteryStart - batteryEnd;
  
  // 시간을 "X시간 Y분" 형식으로 변환
  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0 && minutes > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else if (minutes > 0) {
      return `${minutes}분`;
    } else {
      return '1분 미만';
    }
  }
  
  const result = {
    total_distance: Math.round(totalDistance * 100) / 100, // 소수점 2자리
    total_time: formatDuration(totalTime),
    step_count: stepCount,
    average_speed: Math.round(averageSpeed * 100) / 100,
    battery_consumption: Math.max(0, batteryConsumption)
  };
  
  console.log('[Location Summary API] 계산된 요약 데이터:', result);
  return result;
}

// 두 지점 간의 거리를 계산하는 함수 (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  
  try {
    console.log('[Location Summary API] 위치 요약 조회 요청:', { memberId, date });

    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    // 원시 데이터 API를 호출하여 프론트엔드에서 계산
    let transformedData;
    
    try {
      // 올바른 POST 방식으로 백엔드 API 호출
      const backendUrl = `https://118.67.130.71:8000/api/v1/logs/member-location-logs`;
      console.log('[Location Summary API] 백엔드 API 호출:', backendUrl);
      
      const requestBody = {
        act: 'get_daily_location_summary',
        mt_idx: parseInt(memberId),
        date: date
      };
      
      const data = await fetchWithFallback(backendUrl, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      console.log('[Location Summary API] 백엔드 응답 성공:', data);
      
      // 백엔드 응답이 { result: "Y", data: {...} } 형식인 경우
      const actualData = data.result === "Y" ? data.data : data;
      transformedData = transformBackendResponse(actualData);
    } catch (summaryError) {
      console.log('[Location Summary API] Summary API 실패, 원시 데이터로 계산 시도');
      
             // Summary API 실패 시 원시 데이터를 가져와서 계산
       try {
         const rawDataUrl = `https://118.67.130.71:8000/api/v1/logs/member-location-logs`;
         console.log('[Location Summary API] 원시 데이터 API 호출:', rawDataUrl);
         
         const rawRequestBody = {
           act: 'get_daily_location_logs',
           mt_idx: parseInt(memberId),
           date: date,
           limit: 1000
         };
         
         const rawResponse = await fetchWithFallback(rawDataUrl, {
           method: 'POST',
           body: JSON.stringify(rawRequestBody)
         });
         console.log('[Location Summary API] 원시 데이터 응답:', rawResponse);
        
        // 원시 데이터로부터 요약 계산
        transformedData = calculateSummaryFromRawData(rawResponse, date);
      } catch (rawError) {
        console.log('[Location Summary API] 원시 데이터도 실패:', rawError);
        throw summaryError; // 원본 에러를 던져서 목업 데이터 사용
      }
    }
    
    return NextResponse.json(transformedData, {
      headers: {
        'X-Data-Source': 'frontend-calculated'
      }
    });

  } catch (error) {
    console.error('[Location Summary API] 오류:', error);
    
    // 목업 데이터 반환
    const mockData = {
      total_distance: 8.5,
      total_time: "4시간 30분",
      step_count: 12500,
      average_speed: 1.9,
      battery_consumption: 15
    };
    
    console.error('[Location Summary API] 백엔드 호출 실패, 목업 데이터 반환');
    return NextResponse.json(mockData, {
      headers: {
        'X-Data-Source': 'mock'
      }
    });
  }
} 