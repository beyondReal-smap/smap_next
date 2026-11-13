import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: '아이디와 비밀번호를 입력해주세요.' },
                { status: 400 }
            );
        }

        const backendBase = resolveBackendBaseUrl();
        const backendResponse = await fetch(`${backendBase}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mt_id: username,
                mt_pwd: password,
            }),
        });

        const backendData = await backendResponse.json().catch(() => ({}));

        if (!backendResponse.ok || !backendData?.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: backendData?.message || '아이디 또는 비밀번호가 올바르지 않습니다.',
                },
                { status: 401 }
            );
        }

        const user = backendData.data?.user || backendData.data?.member;
        const token = backendData.data?.token;

        if (!token || !user || Number(user.mt_level ?? 0) < 9) {
            return NextResponse.json(
                {
                    success: false,
                    message: '관리자 권한이 없는 계정입니다.',
                },
                { status: 403 }
            );
        }

        const response = NextResponse.json({
            success: true,
            token,
            user,
            message: '로그인 성공',
        });

        response.cookies.set('admin-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1일
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Admin login error:', error);
        return NextResponse.json(
            {
                success: false,
                message: '서버 오류가 발생했습니다.',
            },
            { status: 500 }
        );
    }
}
