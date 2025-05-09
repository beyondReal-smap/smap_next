'use client';
import Header from '@/components/Header';
import React, { useState } from 'react';

function validateEmail(email: string) {
  return /^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(email);
}

export default function InquiryPage() {
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSend = () => {
    if (!validateEmail(email)) {
      setError('이메일 형식이 올바르지 않습니다.');
      return;
    }
    setError('');
    const subject = encodeURIComponent('[SMAP 문의] 1:1 문의');
    const body = encodeURIComponent(`문의 내용:\n${content}\n\n답변받을 이메일: ${email}`);
    window.location.href = `mailto:support@smap.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-36 flex flex-col">
      <Header title="1:1 문의" />
      <div className="px-5 flex-1">
        <div style={{height: '50px'}} />
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="mb-4">
            <div className="text-gray-900 text-xl font-semibold leading-snug mb-6">문의사항을 남겨주시면<br />빠르게 답변드립니다.</div>
          </div>
          <div className="mb-2 font-normal text-gray-800">문의 내용</div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="문의하실 내용을 입력해 주세요."
            rows={6}
            className="w-full bg-gray-100 rounded-2xl px-4 py-4 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 resize-none border-none"
          />
          <div className="mb-2 font-normal text-gray-800">답변받을 이메일</div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일 주소를 입력해 주세요."
            className="w-full bg-gray-100 rounded-2xl px-4 py-4 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2 border-none"
          />
          {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
          <button
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-md active:bg-indigo-700 transition mt-8"
            disabled={!content.trim() || !validateEmail(email)}
            onClick={handleSend}
          >
            문의하기
          </button>
        </div>
      </div>
    </div>
  );
} 