import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

// 백엔드 응답을 안전하게 변환하는 함수
function transformLocationSummaryResponse(backendData: any) {
  if (backendData.result === 'Y' && backendData.data) {
    return backendData;
  }

  return {
    result: 'Y',
    data: {
      schedule_count: String(backendData.schedule_count || backendData.schedules || '0'),
      distance:
        typeof backendData.distance === 'string'
          ? backendData.distance
          : `${backendData.total_distance || 0}km`,
      duration:
        typeof backendData.duration === 'string'
          ? backendData.duration
          : formatDurationFromSeconds(backendData.total_time || 0),
      steps: backendData.steps || backendData.step_count || 0
    },
    message: '위치 로그 요약 조회 성공'
  };
}

function formatDurationFromSeconds(seconds: number): string {
  if (typeof seconds !== 'number' || seconds <= 0) {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ result: 'N', error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required' },
        { status: 400 }
      );
    }

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/logs/member-location-logs`;

    const requestBody = {
      act: 'get_location_summary',
      mt_idx: parseInt(memberId),
      date: date
    };

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return NextResponse.json(
        { result: 'N', message: '위치 로그 요약을 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const transformedData = transformLocationSummaryResponse(data);
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('위치 로그 요약 API 오류:', error);
    return NextResponse.json(
      { result: 'N', message: '위치 로그 요약 조회 중 서버 오류가 발생했습니다.' },
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