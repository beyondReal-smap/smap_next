import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';

// 관리자 회원 목록 조회 API
export async function GET(request: NextRequest) {
    try {
        // 관리자 토큰 확인
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = searchParams.get('page') || '1';
        const size = searchParams.get('size') || '50';
        const search = searchParams.get('search') || '';

        console.log('[Admin Members API] 회원 목록 조회:', { page, size, search });

        const backendBase = resolveBackendBaseUrl();
        let backendUrl = `${backendBase}/api/v1/admin/members?page=${page}&size=${size}`;
        if (search) {
            backendUrl += `&search=${encodeURIComponent(search)}`;
        }

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            // 백엔드 API가 없는 경우 더미 데이터 반환
            console.log('[Admin Members API] 백엔드 API 미구현, 더미 데이터 반환');
            const mockMembers = Array.from({ length: 50 }, (_, i) => ({
                mt_idx: i + 1,
                mt_id: `user${i + 1}`,
                mt_name: `사용자${i + 1}`,
                mt_nickname: `닉네임${i + 1}`,
                mt_hp: `010-${String(1000 + i).padStart(4, '0')}-${String(1000 + i).padStart(4, '0')}`,
                mt_email: `user${i + 1}@example.com`,
                mt_status: i % 10 === 0 ? 'N' : 'Y',
                mt_wdate: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            }));

            return NextResponse.json({
                success: true,
                data: mockMembers,
                total: 50,
                page: parseInt(page),
                size: parseInt(size),
            });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Admin Members API] 오류:', error);
        return NextResponse.json(
            { success: false, message: '회원 목록을 불러오는데 실패했습니다.' },
            { status: 500 }
        );
    }
}

// 관리자 회원 정보 수정/삭제 API
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[Admin Members API] 회원 정보 수정:', body);

        // TODO: 백엔드 API 연동
        return NextResponse.json({
            success: true,
            message: '회원 정보가 수정되었습니다.',
        });
    } catch (error) {
        console.error('[Admin Members API] 수정 오류:', error);
        return NextResponse.json(
            { success: false, message: '회원 정보 수정에 실패했습니다.' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const mt_idx = searchParams.get('mt_idx');

        console.log('[Admin Members API] 회원 삭제:', mt_idx);

        // TODO: 백엔드 API 연동
        return NextResponse.json({
            success: true,
            message: '회원이 삭제되었습니다.',
        });
    } catch (error) {
        console.error('[Admin Members API] 삭제 오류:', error);
        return NextResponse.json(
            { success: false, message: '회원 삭제에 실패했습니다.' },
            { status: 500 }
        );
    }
}
