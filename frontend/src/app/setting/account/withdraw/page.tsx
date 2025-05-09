"use client";
import Header from '@/components/Header';
import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { FiAlertCircle } from 'react-icons/fi';

export default function WithdrawPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [etcReason, setEtcReason] = useState('');
  const DB_PASSWORD = '1111';

  const reasonList = [
    '서비스가 복잡해요.',
    '필요한 기능이 없어요.',
    '다른 서비스를 이용할래요.',
    '기타 이유',
  ];

  const handleReasonChange = (reason: string) => {
    if (reasons.includes(reason)) {
      setReasons(reasons.filter(r => r !== reason));
    } else {
      setReasons([...reasons, reason]);
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col">
      <Header title="회원탈퇴" />
      <div className="flex-1 px-5 pt-14">
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="text-2xl font-semibold leading-snug mb-8 mt-2">
            본인 확인을 위해<br />비밀번호를 입력해 주세요.
          </div>
          <div className="mb-2 font-semibold text-gray-700">비밀번호</div>
          <div className="relative mb-3">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해주세요."
              className="w-full bg-gray-100 rounded-2xl px-4 py-5 text-lg placeholder-gray-400 focus:outline-none border-none pr-12"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          <div className="text-xs text-gray-400 mb-8">
            비밀번호는 9자 이상,<br />영문/숫자/특수문자를 포함해야 합니다.
          </div>

          <button
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-none active:bg-indigo-700 transition disabled:bg-gray-100 disabled:text-gray-400"
          disabled={password !== DB_PASSWORD}
          onClick={() => setShowReasonModal(true)}
        >
          비밀번호 확인
        </button>
        </div>
      </div>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '16px',
          background: 'white',
          zIndex: 9999,
          boxShadow: '0 -2px 16px 0 rgba(0,0,0,0.04)'
        }}
      >
        
        {showReasonModal && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.01)',
            zIndex: 10000
          }} />
        )}
      </div>

      {/* 탈퇴 사유 모달 */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-[95%] max-w-md mx-auto">
            <div className="text-xl font-bold mb-6">다른 서비스를 이용할래요.</div>
            <div className="space-y-3 mb-4">
              {reasonList.map((reason, idx) => (
                <label key={reason} className="flex items-center gap-2 text-gray-500 text-base">
                  <input
                    type="checkbox"
                    checked={reasons.includes(reason)}
                    onChange={() => handleReasonChange(reason)}
                    className="w-5 h-5 accent-indigo-600 rounded"
                  />
                  {reason}
                </label>
              ))}
            </div>
            <div className="mb-2 font-semibold text-gray-700">기타 이유</div>
            <textarea
              className="w-full bg-gray-100 rounded-2xl px-4 py-4 text-base placeholder-gray-400 focus:outline-none resize-none mb-2 border-none"
              placeholder="탈퇴사유를 입력해주세요."
              value={etcReason}
              onChange={e => setEtcReason(e.target.value)}
              maxLength={1000}
              rows={4}
            />
            <div className="text-right text-xs text-gray-400 mb-4">({etcReason.length}/1000)</div>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center mb-2 text-red-600 font-bold text-base">
                <FiAlertCircle className="mr-1" /> 아래 내용을 확인해주세요
              </div>
              <ul className="text-sm text-gray-700 font-normal list-disc pl-5 space-y-1">
                <li>모든 데이터와 기록이 삭제돼요.</li>
                <li>한 번 탈퇴하시면 복구가 불가능해요.</li>
                <li>재가입 시 이전 정보와 데이터는 복원되지 않아요.</li>
              </ul>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-normal"
                onClick={() => setShowReasonModal(false)}
              >
                탈퇴
              </button>
              <button
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-normal"
                onClick={() => setShowReasonModal(false)}
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 