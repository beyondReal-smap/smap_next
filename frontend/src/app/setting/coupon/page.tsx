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
    <div className="bg-white min-h-screen pb-36 flex flex-col">
      <Header title="쿠폰입력" />
      <div className="px-5 flex-1">
        <div className="h-6" />
        <div className="mb-4">
          <div className="text-xl font-extrabold leading-snug mb-6 mt-5">제공받으신 쿠폰번호를 입력해주세요.</div>
        </div>
        <div className="mb-2 font-semibold text-gray-700">쿠폰번호</div>
        <input
          type="text"
          maxLength={8}
          value={coupon}
          onChange={handleChange}
          placeholder="8자리 쿠폰 번호를 입력하세요"
          className="w-full bg-gray-100 rounded-2xl px-4 py-5 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
        />
        {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
        <div className="text-xs text-gray-400 mb-2">
          8자리 쿠폰 번호를 공백 없이 입력해 주세요.
        </div>
      </div>
      <div className="fixed left-0 right-0 bottom-0 px-4 pb-4 bg-white shadow-[0_-2px_16px_0_rgba(0,0,0,0.04)] z-10">
        <button
          className="w-full mb-20 py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-md active:bg-indigo-700 transition"
          disabled={coupon.length !== 8 || !!error}
        >
          입력했어요!
        </button>
      </div>
    </div>
  );
} 