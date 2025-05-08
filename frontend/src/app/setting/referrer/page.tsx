'use client';
import Header from '@/components/Header';
import React, { useState } from 'react';

export default function ReferrerPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  // 입력값 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 숫자만 허용
    if (/[^0-9]/.test(value)) {
      setError('추천인 코드는 숫자(휴대전화번호)만 입력할 수 있습니다.');
    } else {
      setError('');
    }
    setCode(value.replace(/[^0-9]/g, ''));
  };

  return (
    <div className="bg-white min-h-screen pb-36 flex flex-col">
      <Header title="추천인 입력" />
      <div className="px-5 flex-1">
        <div className="h-6" /> {/* 헤더와 안내문구 사이 여백 */}
        <div className="mb-4">
          <div className="text-xl font-extrabold leading-snug mb-2 mt-5">함께할수록 좋아요.<br />추천인 전화번호를 입력하면<br />나와 추천인 모두 1개월 무료</div>
          <div className="text-gray-400 text-sm mb-8">가입하신 모든 분들께 한 번의 특별한 혜택을 드려요!</div>
        </div>
        <div className="mb-2 font-semibold text-gray-700">추천인 코드</div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={11}
          value={code}
          onChange={handleChange}
          placeholder="추천인코드를 입력해주세요."
          className="w-full bg-gray-100 rounded-2xl px-4 py-5 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
        />
        {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
        <div className="text-xs text-gray-400 mb-2">
          추천인 코드는 추천한 분의 <span className="font-bold text-gray-600">휴대전화번호</span>를 입력해 주세요.
        </div>
      </div>
      <div className="fixed left-0 right-0 bottom-0 px-4 pb-4 bg-white shadow-[0_-2px_16px_0_rgba(0,0,0,0.04)] z-10">
        <button
          className="w-full mb-20 py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-md active:bg-indigo-700 transition"
          disabled={!code || !!error}
        >
          입력했어요!
        </button>
      </div>
    </div>
  );
} 