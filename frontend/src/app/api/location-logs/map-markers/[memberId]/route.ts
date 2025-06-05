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

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const minSpeed = searchParams.get('min_speed') || '1';
    const maxAccuracy = searchParams.get('max_accuracy') || '50';
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);
    queryParams.append('min_speed', minSpeed);
    queryParams.append('max_accuracy', maxAccuracy);
    
    const backendUrl = `https://118.67.130.71:8000/api/v1/logs/member-location-logs/${params.memberId}/map-markers?${queryParams.toString()}`;
    
    const response = await fetchWithFallback(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
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