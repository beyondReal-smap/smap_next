import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../_utils/backend';
import { extractAuthToken } from '@/lib/auth';

// 응답 데이터 변환 함수
function transformResponse(backendData: any) {
  if (backendData && typeof backendData.result === 'string') {
    return backendData;
  }

  if (backendData && (backendData.member_activities || Array.isArray(backendData))) {
    const data = Array.isArray(backendData) ? backendData : backendData;

    return {
      result: 'Y',
      data: data,
      total_members: data.total_members || (data.member_activities ? data.member_activities.length : 0),
      active_members: data.active_members || (data.member_activities ? data.member_activities.filter((m: any) => m.is_active).length : 0),
      success: true,
      message: '조회 성공'
    };
  }

  throw new Error('Invalid backend response format');
}

export async function GET(request: NextRequest) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ result: 'N', success: false, message: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const date = searchParams.get('date');

    if (!groupId || !date) {
      return NextResponse.json(
        {
          result: 'N',
          error: 'group_id and date parameters are required',
          success: false,
          message: '필수 파라미터 누락'
        },
        { status: 400 }
      );
    }

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/logs/member-activity?group_id=${groupId}&date=${date}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[API] 백엔드 응답 오류:', { status: response.status, errorText });
      return NextResponse.json(
        { result: 'N', success: false, message: '멤버 활동 내역을 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const transformedData = transformResponse(data);
    return NextResponse.json(transformedData);

  } catch (error) {
    console.error('[API] member-activity 오류:', error);
    return NextResponse.json(
      { result: 'N', success: false, message: '멤버 활동 내역 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}