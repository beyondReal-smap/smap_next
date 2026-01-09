import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../../_utils/backend';

// 그룹 멤버 목록 조회 API
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ groupId: string }> }
) {
    try {
        const { groupId } = await context.params;

        console.log('[Admin Group Members API] 그룹 멤버 조회:', groupId);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/members/group/${groupId}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('[Admin Group Members API] 백엔드 에러:', response.status);
            // 멤버가 없는 경우 빈 배열 반환
            return NextResponse.json({
                success: true,
                data: [],
            });
        }

        const data = await response.json();
        console.log('[Admin Group Members API] 백엔드 응답 성공, 멤버 수:', Array.isArray(data) ? data.length : 'N/A');

        return NextResponse.json({
            success: true,
            data: Array.isArray(data) ? data : [],
        });
    } catch (error) {
        console.error('[Admin Group Members API] 오류:', error);
        return NextResponse.json({
            success: true,
            data: [],
        });
    }
}
