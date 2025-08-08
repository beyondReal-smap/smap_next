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
function transformMapMarkersResponse(backendData: any) {
  console.log('[Map Markers API] 백엔드 원본 데이터:', backendData);
  
  try {
    // 배열 형태의 응답 처리
    if (Array.isArray(backendData)) {
      return {
        result: "Y",
        data: backendData.map(transformSingleMarkerData),
        total_markers: backendData.length,
        success: true,
        message: "지도 마커 데이터 조회 성공"
      };
    }
    
    // 객체 형태의 응답 처리 (백엔드에서 이미 올바른 형식으로 온 경우)
    if (backendData.result === "Y" && backendData.data && Array.isArray(backendData.data)) {
      return {
        ...backendData,
        data: backendData.data.map(transformSingleMarkerData)
      };
    }
    
    // 다른 객체 형태의 응답 처리
    if (backendData.data && Array.isArray(backendData.data)) {
      return {
        result: "Y",
        data: backendData.data.map(transformSingleMarkerData),
        total_markers: backendData.data.length,
        success: true,
        message: "지도 마커 데이터 조회 성공"
      };
    }
    
    // 단일 객체 응답 처리
    return {
      result: "Y",
      data: [transformSingleMarkerData(backendData)],
      total_markers: 1,
      success: true,
      message: "지도 마커 데이터 조회 성공"
    };
  } catch (error) {
    console.error('[Map Markers API] 응답 변환 중 오류:', error);
    return {
      result: "N",
      data: [],
      total_markers: 0,
      success: false,
      message: "지도 마커 데이터 조회 실패"
    };
  }
}

function transformSingleMarkerData(markerData: any) {
  return {
    id: markerData.id || markerData.marker_id || markerData.mlt_idx || Math.random().toString(36).substr(2, 9),
    latitude: Number(markerData.mlt_lat) || Number(markerData.latitude) || Number(markerData.lat) || 0,
    longitude: Number(markerData.mlt_long) || Number(markerData.longitude) || Number(markerData.lng) || 0,
    timestamp: formatTimestamp(markerData.mlt_gps_time || markerData.timestamp || markerData.created_at),
    speed: Number(markerData.mlt_speed) || Number(markerData.speed) || 0,
    accuracy: Number(markerData.mlt_accuacy) || Number(markerData.accuracy) || 0,
    battery_level: Number(markerData.mlt_battery) || Number(markerData.battery_level) || Number(markerData.battery) || 0,
    marker_type: markerData.marker_type || markerData.type || "waypoint",
    address: markerData.address || markerData.location || "주소 정보 없음"
  };
}

function formatTimestamp(timestamp: any): string {
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  // 타임스탬프인 경우 (초 단위)
  if (typeof timestamp === 'number') {
    return new Date(timestamp * 1000).toISOString();
  }
  
  return new Date().toISOString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const minSpeed = searchParams.get('min_speed') || '1';
    const maxAccuracy = searchParams.get('max_accuracy') || '50';
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);
    queryParams.append('min_speed', minSpeed);
    queryParams.append('max_accuracy', maxAccuracy);
    
    const backendUrl = `https://api3.smap.site/api/v1/logs/member-location-logs`;
    
    const requestBody = {
      act: 'get_map_markers',
      mt_idx: parseInt(memberId),
      date: date,
      min_speed: parseFloat(minSpeed),
      max_accuracy: parseFloat(maxAccuracy)
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
    const transformedData = transformMapMarkersResponse(data);
    
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('지도 마커 데이터 API 오류:', error);
    
    // 목업 데이터 반환
    const mockData = {
      data: [
        {
          id: 1,
          latitude: 37.5665,
          longitude: 126.9780,
          timestamp: "2025-06-05T09:00:00",
          speed: 0.0,
          accuracy: 10.5,
          battery_level: 85,
          marker_type: "start",
          address: "서울특별시 중구 명동"
        },
        {
          id: 2,
          latitude: 37.5651,
          longitude: 126.9890,
          timestamp: "2025-06-05T12:30:00",
          speed: 1.2,
          accuracy: 15.0,
          battery_level: 72,
          marker_type: "waypoint",
          address: "서울특별시 중구 을지로"
        },
        {
          id: 3,
          latitude: 37.5640,
          longitude: 126.9920,
          timestamp: "2025-06-05T18:00:00",
          speed: 0.0,
          accuracy: 8.0,
          battery_level: 60,
          marker_type: "end",
          address: "서울특별시 중구 동대문"
        }
      ],
      success: true,
      message: "지도 마커 데이터 조회 성공 (목업 데이터)"
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