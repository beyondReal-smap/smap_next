import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../_utils/backend';

// 관리자 FCM 푸시 발송 API - 백엔드 /api/v1/fcm_sendone/ 사용
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[Admin FCM API] FCM 푸시 발송 요청:', body);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/fcm_sendone/`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        // FCM 발송 요청 데이터 구성
        const fcmRequest = {
            plt_type: body.plt_type || 'admin',
            sst_idx: body.sst_idx || '0',
            plt_condition: body.plt_condition || 'admin_push',
            plt_memo: body.plt_memo || '',
            mt_idx: body.mt_idx,  // 대상 회원 ID
            plt_title: body.title,
            plt_content: body.content,
        };

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fcmRequest),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Admin FCM API] 발송 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Admin FCM API] 발송 성공:', data);

        return NextResponse.json({
            success: true,
            message: 'FCM 푸시가 발송되었습니다.',
            data,
        });
    } catch (error) {
        console.error('[Admin FCM API] 발송 오류:', error);
        return NextResponse.json(
            { success: false, message: 'FCM 푸시 발송에 실패했습니다.', error: String(error) },
            { status: 500 }
        );
    }
}

// FCM 푸시 이력 조회 - 백엔드 /api/v1/push-logs/ 사용
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const size = parseInt(searchParams.get('size') || '50');
        const skip = (page - 1) * size;

        console.log('[Admin FCM API] 푸시 이력 조회:', { page, size, skip });

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/push-logs/?skip=${skip}&limit=${size}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('[Admin FCM API] 이력 조회 실패:', response.status);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Admin FCM API] 이력 조회 성공, 개수:', Array.isArray(data) ? data.length : 'N/A');

        return NextResponse.json({
            success: true,
            data: Array.isArray(data) ? data : [],
            total: Array.isArray(data) ? data.length : 0,
            page,
            size,
        });
    } catch (error) {
        console.error('[Admin FCM API] 이력 조회 오류:', error);
        return NextResponse.json(
            { success: false, message: 'FCM 푸시 이력을 불러오는데 실패했습니다.', error: String(error) },
            { status: 500 }
        );
    }
}
