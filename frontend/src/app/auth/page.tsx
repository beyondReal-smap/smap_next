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

        const data = await response.json();
        console.log('[AUTH] 백엔드 응답:', data);

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
      } catch (error) {
        console.error('[AUTH] 인증 처리 중 오류:', error);
        setStatus('error');
        setMessage('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      }
    };

    handleAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
      >
        <div className="text-center">
          {status === 'loading' && (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6"
              >
                <FiLoader className="w-8 h-8 text-blue-600" />
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">인증 처리 중</h1>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6"
              >
                <FiCheckCircle className="w-8 h-8 text-green-600" />
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">로그인 성공!</h1>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6"
              >
                <FiAlertCircle className="w-8 h-8 text-red-600" />
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">인증 실패</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <button
                onClick={() => router.push('/signin')}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
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