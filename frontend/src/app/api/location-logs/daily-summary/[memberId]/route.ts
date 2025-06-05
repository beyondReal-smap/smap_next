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
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (date) queryParams.append('date', date);
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);
    
    const backendUrl = `https://118.67.130.71:8000/api/v1/logs/member-location-logs/${params.memberId}/daily-summary?${queryParams.toString()}`;
    
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