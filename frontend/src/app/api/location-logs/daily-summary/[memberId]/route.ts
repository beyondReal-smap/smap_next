import { NextRequest, NextResponse } from 'next/server';

async function fetchWithFallback(url: string, options: RequestInit = {}) {
  try {
    // Try with node-fetch if available
    if (typeof require !== 'undefined') {
      try {
        const fetch = require('node-fetch');
        const https = require('https');
        
        const agent = new https.Agent({
          rejectUnauthorized: false
        });
        
        return await fetch(url, {
          ...options,
          agent
        });
      } catch (nodeError) {
        console.log('Node-fetch failed, falling back to global fetch');
      }
    }
    
    // Fallback to global fetch
    return await fetch(url, options);
  } catch (error) {
    console.error('All fetch methods failed:', error);
    throw error;
  }
}

// 백엔드 응답을 안전하게 변환하는 함수
function transformDailySummaryResponse(backendData: any) {
  console.log('[Daily Summary API] 백엔드 원본 데이터:', backendData);
  
  try {
    // 배열 형태의 응답 처리
    if (Array.isArray(backendData)) {
      return {
        data: backendData.map(transformSingleDayData),
        success: true,
        message: "일일 요약 조회 성공"
      };
    }
    
    // 객체 형태의 응답 처리
    if (backendData.data && Array.isArray(backendData.data)) {
      return {
        ...backendData,
        data: backendData.data.map(transformSingleDayData)
      };
    }
    
    // 단일 객체 응답 처리
    return {
      data: [transformSingleDayData(backendData)],
      success: true,
      message: "일일 요약 조회 성공"
    };
  } catch (error) {
    console.error('[Daily Summary API] 응답 변환 중 오류:', error);
    return {
      data: [],
      success: false,
      message: "일일 요약 조회 실패"
    };
  }
}

function transformSingleDayData(dayData: any) {
  return {
    date: dayData.date || new Date().toISOString().split('T')[0],
    total_distance: Number(dayData.total_distance) || 0,
    total_time: formatTimeString(dayData.total_time),
    step_count: Number(dayData.step_count) || Number(dayData.steps) || 0,
    avg_speed: Number(dayData.avg_speed) || Number(dayData.average_speed) || 0,
    max_speed: Number(dayData.max_speed) || 0,
    avg_battery: Number(dayData.avg_battery) || Number(dayData.average_battery) || 0,
    min_battery: Number(dayData.min_battery) || 0,
    max_battery: Number(dayData.max_battery) || 100
  };
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
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);
    
    const backendUrl = `https://118.67.130.71:8000/api/v1/logs/member-location-logs`;
    
    const requestBody = {
      act: 'get_daily_summary',
      mt_idx: parseInt(memberId),
      date: date,
      start_date: startDate,
      end_date: endDate
    };
    
    const response = await fetchWithFallback(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // 백엔드 응답을 안전하게 변환
    const transformedData = transformDailySummaryResponse(data);
    
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('일일 요약 API 오류:', error);
    
    // 목업 데이터 반환
    const mockData = {
      data: [
        {
          date: "2025-06-05",
          total_distance: 5.2,
          total_time: "02:30:00",
          step_count: 6500,
          avg_speed: 2.1,
          max_speed: 4.5,
          avg_battery: 75,
          min_battery: 60,
          max_battery: 90
        }
      ],
      success: true,
      message: "일일 요약 조회 성공 (목업 데이터)"
    };
    
    return NextResponse.json(mockData);
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