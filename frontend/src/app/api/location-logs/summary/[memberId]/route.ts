import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

async function fetchWithFallback(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err: any = new Error(`API error: ${response.status} - ${errorText}`);
    err.status = response.status;
    throw err;
  }

  return await response.json();
}

// 백엔드 응답을 프론트엔드 형식으로 변환하는 함수
function transformBackendResponse(backendData: any) {
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
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const authHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };

    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/logs/member-location-logs`;
    let transformedData;

    try {
      const requestBody = {
        act: 'get_daily_location_summary',
        mt_idx: parseInt(memberId),
        date: date
      };

      const data = await fetchWithFallback(backendUrl, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(requestBody)
      });

      const actualData = data.result === 'Y' ? data.data : data;
      transformedData = transformBackendResponse(actualData);
    } catch (summaryError: any) {
      const rawRequestBody = {
        act: 'get_daily_location_logs',
        mt_idx: parseInt(memberId),
        date: date,
        limit: 1000
      };

      const rawResponse = await fetchWithFallback(backendUrl, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(rawRequestBody)
      });
      transformedData = calculateSummaryFromRawData(rawResponse, date);
    }

    return NextResponse.json(transformedData, {
      headers: { 'X-Data-Source': 'backend-direct' }
    });

  } catch (error: any) {
    console.error('[Location Summary API] 오류:', error);
    return NextResponse.json(
      { error: '위치 요약을 불러오는데 실패했습니다.' },
      { status: error?.status || 500 }
    );
  }
} 