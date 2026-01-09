import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../_utils/backend';

// 관리자 대시보드 통계 API
export async function GET(request: NextRequest) {
    try {
        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/admin/stats`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('[Admin Stats API] 백엔드 에러:', response.status);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Admin Stats API] 백엔드 응답:', data);

        return NextResponse.json(data);
    } catch (error) {
        console.error('[Admin Stats API] 오류:', error);
        return NextResponse.json(
            {
                success: false,
                message: '통계를 불러오는데 실패했습니다.',
                data: {
                    total_members: 0,
                    total_groups: 0,
                    today_signups: 0,
                    pending_inquiries: 0
                }
            },
            { status: 500 }
        );
    }
}
