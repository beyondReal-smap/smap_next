import { NextRequest, NextResponse } from 'next/server';
import authService from '@/services/authService';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const status = searchParams.get('status');
    const payType = searchParams.get('payType');
    const page = searchParams.get('page') || '1';
    const size = searchParams.get('size') || '20';

    if (!memberId) {
      return NextResponse.json(
        { error: '회원 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 토큰 가져오기
    const token = authService.getToken();
    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 쿼리 파라미터 구성
    const queryParams = new URLSearchParams({
      page,
      size
    });

    if (status) queryParams.append('status', status);
    if (payType) queryParams.append('pay_type', payType);

    const response = await fetch(
      `${BACKEND_URL}/api/v1/orders/${memberId}?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || '주문 목록 조회에 실패했습니다' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('주문 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 