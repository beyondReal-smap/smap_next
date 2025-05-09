"use client";
import Header from '@/components/Header';
import React from 'react';

const terms = [
  {
    title: '서비스 이용약관',
    description: '서비스 이용에 대한 기본적인 약관입니다.',
    link: '/setting/terms/service',
  },
  {
    title: '개인정보 처리방침',
    description: '개인정보의 수집 및 이용, 보호에 관한 정책입니다.',
    link: '/setting/terms/privacy',
  },
  {
    title: '위치기반서비스 이용약관',
    description: '위치기반서비스 이용에 대한 약관입니다.',
    link: '/setting/terms/location',
  },
];

export default function TermsPage() {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Header title="약관 및 동의 관리" />
      <div className="flex-1 px-4 pt-12">
        <div className="space-y-4">
          {terms.map(term => (
            <div key={term.title} className="bg-white rounded-2xl shadow-md p-6">
              <div className="text-lg font-bold mb-1">{term.title}</div>
              <div className="text-gray-500 text-sm mb-2">{term.description}</div>
              <a href={term.link} className="text-indigo-600 text-sm font-medium hover:underline">자세히 보기</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 