'use client';
import Header from '@/components/Header';
import React, { useState, useRef, useLayoutEffect } from 'react';

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
    <div className="bg-gray-50 min-h-screen pb-36 flex flex-col">
      <Header title="추천인 입력" />
      <div className="flex-1 px-5">
        <div style={{height: '50px'}} />
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="mb-4">
            <div className="text-xl font-semibold text-gray-900 leading-snug mb-2">추천인 전화번호 입력 시<br />1개월 무료 이용</div>
            <div className="text-gray-400 text-sm mb-8">특별한 혜택을 드려요!</div>
          </div>
          <div className="mb-2 font-normal text-gray-800">추천인 코드</div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={11}
            value={code}
            onChange={handleChange}
            placeholder="추천인코드를 입력해주세요."
            className="w-full bg-gray-100 rounded-2xl px-4 py-5 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2 border-none"
          />
          {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
          <div className="text-xs text-gray-400 mb-2">
            추천인의 <span className="font-bold text-gray-600">휴대전화번호</span>를 입력해주세요.
          </div>
          <button
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-md active:bg-indigo-700 transition mt-8"
            disabled={!code || !!error}
          >
            입력했어요!
          </button>
        </div>
      </div>
    </div>
  );
} 