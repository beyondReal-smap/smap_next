import { NextRequest, NextResponse } from 'next/server';

// 관리자 계정 (실제 운영에서는 DB에서 관리)
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'smap2024!admin',
};

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        // 간단한 인증 체크
        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            // 간단한 토큰 생성 (실제 운영에서는 JWT 사용)
            const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');

            return NextResponse.json({
                success: true,
                token,
                message: '로그인 성공',
            });
        }

        return NextResponse.json({
            success: false,
            message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        }, { status: 401 });

    } catch (error) {
        console.error('Admin login error:', error);
        return NextResponse.json({
            success: false,
            message: '서버 오류가 발생했습니다.',
        }, { status: 500 });
    }
}
