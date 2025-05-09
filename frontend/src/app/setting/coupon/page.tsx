'use client';
import Header from '@/components/Header';
import React, { useState } from 'react';

export default function CouponPage() {
  const [coupon, setCoupon] = useState('');
  const [error, setError] = useState('');

  // 입력값 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 영문/숫자만 허용
    if (/[^a-zA-Z0-9]/.test(value)) {
      setError('쿠폰 번호는 영문과 숫자만 입력할 수 있습니다.');
    } else {
      setError('');
    }
    setCoupon(value.replace(/[^a-zA-Z0-9]/g, ''));
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-36 flex flex-col">
      <Header title="쿠폰입력" />
      <div className="px-5 flex-1">
        <div style={{height: '50px'}} />
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="mb-4">
            <div className="text-xl font-semibold leading-snug mb-6">제공받으신 쿠폰번호를<br />입력해주세요.</div>
          </div>
          <div className="mb-2 font-normal text-gray-800">쿠폰번호</div>
          <input
            type="text"
            maxLength={8}
            value={coupon}
            onChange={handleChange}
            placeholder="8자리 쿠폰 번호를 입력하세요"
            className="w-full bg-gray-100 rounded-2xl px-4 py-5 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2 border-none"
          />
          {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
          <div className="text-xs text-gray-400 mb-2">
            8자리 쿠폰 번호를 공백 없이 입력해 주세요.
          </div>
          <button
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-md active:bg-indigo-700 transition mt-8"
            disabled={coupon.length !== 8 || !!error}
          >
            입력했어요!
          </button>
        </div>
      </div>
    </div>
  );
} 