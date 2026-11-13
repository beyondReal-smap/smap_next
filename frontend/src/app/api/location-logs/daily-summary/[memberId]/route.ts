import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

async function fetchWithFallback(url: string, options: RequestInit = {}) {
  return await fetch(url, options);
}

// 백엔드 응답을 안전하게 변환하는 함수
function transformDailySummaryResponse(backendData: any) {
  console.log('[Daily Summary API] 데이터 타입 분석:', {
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
    // 1. 백엔드에서 이미 올바른 형식으로 온 경우 (result: "Y" 포함)
    if (backendData.result === "Y" && backendData.data && Array.isArray(backendData.data)) {
      console.log('[Daily Summary API] 케이스 1: 백엔드에서 올바른 형식');
      return {
        ...backendData,
        data: backendData.data.map(transformSingleDayData)
      };
    }
    
    // 2. 배열 형태의 응답 처리
    if (Array.isArray(backendData)) {
      console.log('[Daily Summary API] 케이스 2: 배열 형태 응답');
      return {
        result: "Y",
        data: backendData.map(transformSingleDayData),
        total_days: backendData.length,
        success: true,
        message: "일일 요약 조회 성공"
      };
    }
    
    // 3. data 필드가 배열인 경우 (result 필드 없어도 처리)
    if (backendData.data && Array.isArray(backendData.data)) {
      console.log('[Daily Summary API] 케이스 3: data 필드가 배열 (result 무시)');
      return {
        result: "Y",
        data: backendData.data.map(transformSingleDayData),
        total_days: backendData.data.length,
        success: true,
        message: "일일 요약 조회 성공"
      };
    }
    
    // 3.5. 백엔드에서 result 필드 없이 다른 형식으로 온 경우 (Vercel 환경 대응)
    if (backendData && typeof backendData === 'object' && !Array.isArray(backendData) && !backendData.result) {
      console.log('[Daily Summary API] 케이스 3.5: result 필드 없는 객체 응답 (Vercel 환경)');
      
      // 가능한 데이터 필드들을 확인
      const possibleDataFields = ['data', 'summary', 'daily_summary', 'results'];
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
            data: foundData.map(transformSingleDayData),
            total_days: foundData.length,
            success: true,
            message: "일일 요약 조회 성공 (Vercel 환경)"
          };
        } else {
          return {
            result: "Y",
            data: [transformSingleDayData(foundData)],
            total_days: 1,
            success: true,
            message: "일일 요약 조회 성공 (Vercel 환경)"
          };
        }
      }
      
      // 데이터 필드를 찾지 못한 경우 전체 객체를 단일 데이터로 처리
      return {
        result: "Y",
        data: [transformSingleDayData(backendData)],
        total_days: 1,
        success: true,
        message: "일일 요약 조회 성공 (전체 객체 처리)"
      };
    }
    
    // 4. data 필드가 있지만 배열이 아닌 경우
    if (backendData.data && !Array.isArray(backendData.data)) {
      console.log('[Daily Summary API] 케이스 4: data 필드가 단일 객체');
      return {
        result: "Y",
        data: [transformSingleDayData(backendData.data)],
        total_days: 1,
        success: true,
        message: "일일 요약 조회 성공"
      };
    }
    
    // 5. 단일 객체 응답 처리 (data 필드 없음)
    console.log('[Daily Summary API] 케이스 5: 단일 객체 응답');
    return {
      result: "Y",
      data: [transformSingleDayData(backendData)],
      total_days: 1,
      success: true,
      message: "일일 요약 조회 성공"
    };
  } catch (error) {
    console.error('[Daily Summary API] 응답 변환 중 오류:', error);
    return {
      result: "N",
      data: [],
      total_days: 0,
      success: false,
      message: "일일 요약 조회 실패"
    };
  }
}

function transformSingleDayData(dayData: any) {
  console.log('[Daily Summary API] 단일 데이터 변환:', dayData);
  
  // 백엔드 CRUD에서 반환하는 실제 필드명에 맞게 처리
  const result = {
    mlt_idx: dayData.mlt_idx || 0,
    log_date: dayData.log_date || dayData.date || new Date().toISOString().split('T')[0],
    start_time: dayData.start_time || '',
    end_time: dayData.end_time || ''
  };
  
  console.log('[Daily Summary API] 변환된 데이터:', result);
  return result;
}

function formatTimeString(timeValue: any): string {
  if (typeof timeValue === 'string') {
    return timeValue;
  }
  
  if (typeof timeValue === 'number') {
    // 초 단위를 "HH:MM:SS" 형식으로 변환
    const hours = Math.floor(timeValue / 3600);
    const minutes = Math.floor((timeValue % 3600) / 60);
    const seconds = timeValue % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return "00:00:00";
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
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/logs/member-location-logs`;

    const requestBody = {
      act: startDate && endDate ? 'get_daily_summary_by_range' : 'get_daily_summary',
      mt_idx: parseInt(memberId),
      date: date,
      start_date: startDate,
      end_date: endDate
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
        { success: false, message: '일일 요약을 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const transformedData = transformDailySummaryResponse(data);
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('일일 요약 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '일일 요약 조회 중 서버 오류가 발생했습니다.' },
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