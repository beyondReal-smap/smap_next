import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'smap!@super-secret';

export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          success: false, 
          message: '인증 토큰이 필요합니다.' 
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // JWT 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error('JWT 토큰 검증 실패:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: '유효하지 않은 토큰입니다.' 
        },
        { status: 401 }
      );
    }

    // 토큰에서 사용자 정보 추출
    let userData = {
      mt_idx: decoded.mt_idx,
      mt_id: decoded.mt_id,
      mt_name: decoded.mt_name,
      mt_nickname: decoded.mt_nickname,
      mt_hp: decoded.mt_hp,
      mt_email: decoded.mt_email,
      mt_birth: decoded.mt_birth,
      mt_gender: decoded.mt_gender,
      mt_level: decoded.mt_level,
      mt_type: decoded.mt_type
    };

    // JWT에 mt_birth나 mt_gender가 없으면 백엔드에서 완전한 정보 가져오기
    if (!userData.mt_birth || userData.mt_gender === undefined || userData.mt_gender === null) {
      console.log('🔄 JWT에 완전한 정보가 없음, 백엔드에서 사용자 정보 조회');
      
      try {
        // fetchWithFallback 함수 정의 (profile API와 동일)
        const fetchWithFallback = async (url: string, options: any = {}): Promise<any> => {
          const fetchOptions: RequestInit = {
            method: options.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Next.js API Proxy',
              ...options.headers,
            },
            body: options.body,
            // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
            rejectUnauthorized: false,
          };
          
          // Node.js 환경 변수로 SSL 검증 비활성화
          const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          
          let response: any;
        
          try {
            try {
              // 기본 fetch 시도
              response = await fetch(url, fetchOptions);
            } catch (fetchError) {
              // node-fetch 시도
              const nodeFetch = require('node-fetch');
              if (nodeFetch) {
                response = await nodeFetch(url, {
                  method: options.method || 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Next.js API Proxy (node-fetch)',
                    ...options.headers,
                  },
                  body: options.body,
                  agent: function(_parsedURL: any) {
                    const https = require('https');
                    return new https.Agent({
                      rejectUnauthorized: false
                    });
                  }
                });
              } else {
                throw fetchError;
              }
            }
        
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`API error: ${response.status} - ${errorText}`);
            }
        
            return await response.json();
          } finally {
            // 환경 변수 복원
            if (originalTlsReject !== undefined) {
              process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
            } else {
              delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
            }
          }
        };

const BACKEND_URL = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
        const backendData = await fetchWithFallback(`${BACKEND_URL}/api/v1/members/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

                 if (backendData.success && backendData.data) {
           console.log('✅ 백엔드에서 완전한 사용자 정보 조회 성공');
           console.log('🔍 백엔드 응답 데이터:', JSON.stringify(backendData.data, null, 2));
           console.log('🔍 백엔드 mt_birth:', backendData.data.mt_birth, typeof backendData.data.mt_birth);
           console.log('🔍 백엔드 mt_gender:', backendData.data.mt_gender, typeof backendData.data.mt_gender);
           
           userData = {
             mt_idx: backendData.data.mt_idx,
             mt_id: backendData.data.mt_id,
             mt_name: backendData.data.mt_name,
             mt_nickname: backendData.data.mt_nickname,
             mt_hp: backendData.data.mt_hp,
             mt_email: backendData.data.mt_email,
             mt_birth: backendData.data.mt_birth,
             mt_gender: backendData.data.mt_gender,
             mt_level: backendData.data.mt_level,
             mt_type: backendData.data.mt_type
           };
           
           console.log('🎯 최종 userData:', JSON.stringify(userData, null, 2));
         }
      } catch (backendError) {
        console.warn('⚠️ 백엔드에서 사용자 정보 조회 실패, JWT 정보 사용:', backendError);
      }
    }

    return NextResponse.json({
      success: true,
      data: userData,
      message: '사용자 정보 조회 성공'
    });

  } catch (error) {
    console.error('❌ 사용자 정보 조회 API 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
      },
      { status: 500 }
    );
  }
} 