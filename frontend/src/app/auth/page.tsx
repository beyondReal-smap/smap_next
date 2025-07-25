'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('인증 처리 중...');

  useEffect(() => {
    const handleAuth = async () => {
      try {
        console.log('[AUTH] 인증 페이지 로드됨');
        
        // URL 파라미터 확인
        const tokenId = searchParams.get('mt_token_id');
        const lat = searchParams.get('mt_lat');
        const long = searchParams.get('mt_long');
        
        console.log('[AUTH] URL 파라미터:', { tokenId: !!tokenId, lat, long });
        
        if (!tokenId) {
          console.error('[AUTH] 토큰이 없습니다');
          setStatus('error');
          setMessage('인증 토큰이 없습니다. 다시 로그인해주세요.');
          return;
        }

        // 백엔드 API로 토큰 전송
        console.log('[AUTH] 백엔드 API 호출 시작');
        
        try {
          const response = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tokenId,
              lat: lat ? parseFloat(lat) : null,
              long: long ? parseFloat(long) : null,
            }),
          });

          console.log('[AUTH] 백엔드 응답 상태:', response.status);
          console.log('[AUTH] 백엔드 응답 헤더:', Object.fromEntries(response.headers.entries()));

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[AUTH] 백엔드 오류 응답:', {
              status: response.status,
              statusText: response.statusText,
              errorText
            });
            
            setStatus('error');
            setMessage(`서버 오류가 발생했습니다. (${response.status}) 다시 시도해주세요.`);
            return;
          }

          const data = await response.json();
          console.log('[AUTH] 백엔드 응답 데이터:', data);

          if (data.success) {
            console.log('[AUTH] 인증 성공');
            setStatus('success');
            setMessage('로그인 성공! 홈으로 이동합니다...');
            
            // 2초 후 홈으로 리다이렉트
            setTimeout(() => {
              router.replace('/home');
            }, 2000);
          } else {
            console.error('[AUTH] 인증 실패:', data.error);
            setStatus('error');
            setMessage(data.error || '인증에 실패했습니다. 다시 시도해주세요.');
          }
        } catch (fetchError: any) {
          console.error('[AUTH] 백엔드 API 호출 실패:', fetchError);
          
          // 네트워크 오류인지 확인
          if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
            setStatus('error');
            setMessage('서버에 연결할 수 없습니다. 네트워크 연결을 확인하고 다시 시도해주세요.');
            return;
          }
          
          // 타임아웃 오류인지 확인
          if (fetchError.name === 'AbortError') {
            setStatus('error');
            setMessage('요청 시간이 초과되었습니다. 다시 시도해주세요.');
            return;
          }
          
          throw fetchError; // 다른 오류는 상위로 전파
        }
      } catch (error) {
        console.error('[AUTH] 인증 처리 중 오류:', error);
        setStatus('error');
        setMessage('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      }
    };

    handleAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-lg shadow-lg p-8"
      >
        <div className="text-center">
          {status === 'loading' && (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="mx-auto w-12 h-12 text-blue-600 mb-4"
              >
                <FiLoader className="w-full h-full" />
              </motion.div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">인증 처리 중</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mx-auto w-12 h-12 text-green-600 mb-4"
              >
                <FiCheckCircle className="w-full h-full" />
              </motion.div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">인증 성공</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mx-auto w-12 h-12 text-red-600 mb-4"
              >
                <FiAlertCircle className="w-full h-full" />
              </motion.div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">인증 실패</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <button
                onClick={() => router.push('/signin')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                로그인 페이지로 돌아가기
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
} 