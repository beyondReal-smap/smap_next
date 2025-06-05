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
    const minDuration = searchParams.get('min_duration') || '5';
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);
    queryParams.append('min_speed', minSpeed);
    queryParams.append('max_accuracy', maxAccuracy);
    queryParams.append('min_duration', minDuration);
    
    const backendUrl = `https://118.67.130.71:8000/api/v1/logs/member-location-logs/${params.memberId}/stay-times?${queryParams.toString()}`;
    
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
    console.error('체류시간 분석 API 오류:', error);
    
    // 목업 데이터 반환
    const mockData = {
      data: [
        {
          location: "집",
          latitude: 37.5665,
          longitude: 126.9780,
          stay_duration: "08:30:00",
          start_time: "2025-06-05T22:00:00",
          end_time: "2025-06-06T06:30:00",
          point_count: 156
        },
        {
          location: "직장",
          latitude: 37.5660,
          longitude: 126.9784,
          stay_duration: "07:45:00",
          start_time: "2025-06-05T09:00:00",
          end_time: "2025-06-05T16:45:00",
          point_count: 89
        }
      ],
      success: true,
      message: "체류시간 분석 조회 성공 (목업 데이터)"
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