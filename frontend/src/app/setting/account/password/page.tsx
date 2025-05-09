'use client';
import Header from '@/components/Header';
import React, { useState } from 'react';
import { FiEye, FiEyeOff, FiLock, FiKey } from 'react-icons/fi';

export default function PasswordChangePage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [nextCheck, setNextCheck] = useState('');
  const [error, setError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showNextCheck, setShowNextCheck] = useState(false);

  // 실시간 비교
  const isMismatch = next && nextCheck && next !== nextCheck;

  const handleSave = () => {
    if (!current || !next || !nextCheck) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    if (next !== nextCheck) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setError('');
    // 실제 저장 로직은 별도 구현
    alert('비밀번호가 변경되었습니다!');
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Header title="비밀번호 변경" />
      <div className="px-4 flex-1 max-w-md mx-auto w-full">
        <div style={{height: '50px'}} />
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="mb-5">
            <label className="mb-2 font-semibold text-gray-700 block flex items-center gap-1">
              <span className="text-indigo-500"><FiLock /></span>
              현재 비밀번호
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-base border-none placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-12"
                placeholder="현재 비밀번호를 입력하세요"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowCurrent(v => !v)}>
                {showCurrent ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          <hr className="my-4 border-gray-200" />
          <div className="mb-5">
            <label className="mb-2 font-semibold text-gray-700 block flex items-center gap-1">
              <span className="text-red-500"><FiKey /></span>
              새 비밀번호
            </label>
            <div className="relative">
              <input
                type={showNext ? 'text' : 'password'}
                value={next}
                onChange={e => setNext(e.target.value)}
                className={`w-full bg-gray-100 rounded-xl px-4 py-3 text-base border-none placeholder-gray-400 focus:outline-none pr-12 ${isMismatch ? 'ring-2 ring-red-400 border-red-400' : 'focus:ring-2 focus:ring-indigo-400'}`}
                placeholder="새 비밀번호를 입력하세요"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowNext(v => !v)}>
                {showNext ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          <div className="mb-5">
            <label className="mb-2 font-semibold text-gray-700 block flex items-center gap-1">
              <span className="text-yellow-500"><FiKey /></span>
              새 비밀번호 확인
            </label>
            <div className="relative">
              <input
                type={showNextCheck ? 'text' : 'password'}
                value={nextCheck}
                onChange={e => setNextCheck(e.target.value)}
                className={`w-full bg-gray-100 rounded-xl px-4 py-3 text-base border-none placeholder-gray-400 focus:outline-none pr-12 ${isMismatch ? 'ring-2 ring-red-400 border-red-400' : 'focus:ring-2 focus:ring-indigo-400'}`}
                placeholder="새 비밀번호를 다시 입력하세요"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowNextCheck(v => !v)}>
                {showNextCheck ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {isMismatch && <div className="text-red-500 text-sm mt-2">새 비밀번호가 일치하지 않습니다.</div>}
          </div>
          {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
          <button
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-md active:bg-indigo-700 transition"
            onClick={handleSave}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
} 