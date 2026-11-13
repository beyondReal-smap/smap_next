import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

async function fetchWithFallback(url: string, options: RequestInit = {}) {
  return await fetch(url, options);
}

// 백엔드 응답을 안전하게 변환하는 함수
function transformStayTimesResponse(backendData: any) {
  console.log('[Stay Times API] 데이터 타입 분석:', {
    isArray: Array.isArray(backendData),
    hasResult: 'result' in backendData,
    resultValue: backendData.result,
    hasData: 'data' in backendData,
    dataType: typeof backendData.data,
    isDataArray: Array.isArray(backendData.data),
    dataLength: Array.isArray(backendData.data) ? backendData.data.length : 'N/A',
    keys: Object.keys(backendData)
  });
  
  try {
    // 1. 배열 형태의 응답 처리
    if (Array.isArray(backendData)) {
      console.log('[Stay Times API] 케이스 1: 배열 형태 응답');
      return {
        result: "Y",
        data: backendData.map(transformSingleStayData),
        total_stays: backendData.length,
        success: true,
        message: "체류시간 분석 조회 성공"
      };
    }
    
    // 2. 객체 형태의 응답 처리 (백엔드에서 이미 올바른 형식으로 온 경우)
    if (backendData.result === "Y" && backendData.data && Array.isArray(backendData.data)) {
      console.log('[Stay Times API] 케이스 2: 백엔드에서 올바른 형식');
      return {
        ...backendData,
        data: backendData.data.map(transformSingleStayData)
      };
    }
    
    // 3. data 필드가 배열인 경우 (result 필드 없어도 처리)
    if (backendData.data && Array.isArray(backendData.data)) {
      console.log('[Stay Times API] 케이스 3: data 필드가 배열 (result 무시)');
      return {
        result: "Y",
        data: backendData.data.map(transformSingleStayData),
        total_stays: backendData.data.length,
        success: true,
        message: "체류시간 분석 조회 성공"
      };
    }
    
    // 4. 백엔드에서 result 필드 없이 다른 형식으로 온 경우 (Vercel 환경 대응)
    if (backendData && typeof backendData === 'object' && !Array.isArray(backendData) && !backendData.result) {
      console.log('[Stay Times API] 케이스 4: result 필드 없는 객체 응답 (Vercel 환경)');
      
      // 가능한 데이터 필드들을 확인
      const possibleDataFields = ['data', 'stay_times', 'stays', 'results'];
      let foundData = null;
      
      for (const field of possibleDataFields) {
        if (backendData[field]) {
          foundData = backendData[field];
          break;
        }
      }
      
      if (foundData) {
        if (Array.isArray(foundData)) {
          return {
            result: "Y",
            data: foundData.map(transformSingleStayData),
            total_stays: foundData.length,
            success: true,
            message: "체류시간 분석 조회 성공 (Vercel 환경)"
          };
        } else {
          return {
            result: "Y",
            data: [transformSingleStayData(foundData)],
            total_stays: 1,
            success: true,
            message: "체류시간 분석 조회 성공 (Vercel 환경)"
          };
        }
      }
      
      // 데이터 필드를 찾지 못한 경우 전체 객체를 단일 데이터로 처리
      return {
        result: "Y",
        data: [transformSingleStayData(backendData)],
        total_stays: 1,
        success: true,
        message: "체류시간 분석 조회 성공 (전체 객체 처리)"
      };
    }
    
    // 5. 단일 객체 응답 처리
    console.log('[Stay Times API] 케이스 5: 단일 객체 응답');
    return {
      result: "Y",
      data: [transformSingleStayData(backendData)],
      total_stays: 1,
      success: true,
      message: "체류시간 분석 조회 성공"
    };
  } catch (error) {
    console.error('[Stay Times API] 응답 변환 중 오류:', error);
    return {
      result: "N",
      data: [],
      total_stays: 0,
      success: false,
      message: "체류시간 분석 조회 실패"
    };
  }
}

function transformSingleStayData(stayData: any) {
  // start_time과 end_time으로 실제 체류시간 계산
  let durationMinutes = 0;
  
  const startTime = stayData.start_time || stayData.startTime;
  const endTime = stayData.end_time || stayData.endTime;
  
  if (startTime && endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      // 밀리초 차이를 분으로 변환
      const diffMs = end.getTime() - start.getTime();
      durationMinutes = diffMs / (1000 * 60); // 분 단위로 변환
      
      console.log(`[transformSingleStayData] 시간 계산:`, {
        start_time: startTime,
        end_time: endTime,
        diffMs: diffMs,
        durationMinutes: durationMinutes
      });
    } catch (error) {
      console.error('[transformSingleStayData] 시간 파싱 오류:', error);
      
      // 시간 파싱 실패 시 기존 duration 값 사용
      if (typeof stayData.duration === 'number') {
        // 시간 단위인 경우 분으로 변환
        durationMinutes = stayData.duration * 60;
      } else if (typeof stayData.duration === 'string') {
        // "HH:MM:SS" 형식의 문자열인 경우 분으로 변환
        const timeParts = stayData.duration.split(':');
        if (timeParts.length >= 2) {
          const hours = parseInt(timeParts[0]) || 0;
          const minutes = parseInt(timeParts[1]) || 0;
          const seconds = timeParts.length > 2 ? (parseFloat(timeParts[2]) || 0) : 0;
          durationMinutes = hours * 60 + minutes + seconds / 60;
        }
      }
    }
  } else {
    // start_time, end_time이 없는 경우 기존 duration 값 사용
    if (typeof stayData.duration === 'number') {
      // 시간 단위인 경우 분으로 변환 (0.67시간 = 40.2분)
      durationMinutes = stayData.duration * 60;
    } else if (typeof stayData.duration === 'string') {
      // "HH:MM:SS" 형식의 문자열인 경우 분으로 변환
      const timeParts = stayData.duration.split(':');
      if (timeParts.length >= 2) {
        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const seconds = timeParts.length > 2 ? (parseFloat(timeParts[2]) || 0) : 0;
        durationMinutes = hours * 60 + minutes + seconds / 60;
      }
    }
  }

  return {
    location: stayData.location || stayData.place_name || stayData.label || "알 수 없는 장소",
    latitude: Number(stayData.start_lat) || Number(stayData.latitude) || Number(stayData.lat) || 0,
    longitude: Number(stayData.start_long) || Number(stayData.longitude) || Number(stayData.lng) || 0,
    duration: durationMinutes, // 숫자 형태의 분 단위 체류시간 추가
    stay_duration: formatStayDuration(stayData.duration || stayData.stay_duration),
    start_time: formatDateTime(stayData.start_time || stayData.startTime),
    end_time: formatDateTime(stayData.end_time || stayData.endTime),
    point_count: Number(stayData.point_count) || Number(stayData.points) || 0,
    // 백엔드 원본 필드도 보존
    label: stayData.label,
    grp: stayData.grp,
    distance: stayData.distance,
    start_lat: Number(stayData.start_lat) || 0,
    start_long: Number(stayData.start_long) || 0
  };
}

function formatStayDuration(duration: any): string {
  if (typeof duration === 'string') {
    return duration;
  }
  
  if (typeof duration === 'number') {
    // 초 단위를 "HH:MM:SS" 형식으로 변환
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return "00:00:00";
}

function formatDateTime(dateTime: any): string {
  if (typeof dateTime === 'string') {
    return dateTime;
  }
  
  if (dateTime instanceof Date) {
    return dateTime.toISOString();
  }
  
  // 타임스탬프인 경우
  if (typeof dateTime === 'number') {
    return new Date(dateTime * 1000).toISOString();
  }
  
  return new Date().toISOString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ success: false, message: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const minSpeed = searchParams.get('min_speed') || '1';
    const maxAccuracy = searchParams.get('max_accuracy') || '50';
    const minDuration = searchParams.get('min_duration') || '5';
    
    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/logs/member-location-logs`;
    
    const requestBody = {
      act: 'get_stay_times',
      mt_idx: parseInt(memberId),
      date: date,
      min_speed: parseFloat(minSpeed),
      max_accuracy: parseFloat(maxAccuracy),
      min_duration: parseInt(minDuration)
    };
    
    const response = await fetchWithFallback(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: '체류시간 분석을 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const transformedData = transformStayTimesResponse(data);
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('체류시간 분석 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '체류시간 분석 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 