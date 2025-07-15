'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [userName, setUserName] = useState('사용자');
  const [recentSchedules, setRecentSchedules] = useState([
    { id: '1', title: '팀 미팅', date: '오늘 14:00', location: '강남 사무실' },
    { id: '2', title: '프로젝트 발표', date: '내일 10:00', location: '회의실 A' },
    { id: '3', title: '주간 회의', date: '수요일 11:00', location: '본사 대회의실' },
  ]);
  
  const [favoriteLocations, setFavoriteLocations] = useState([
    { id: '1', name: '회사', address: '서울시 강남구 테헤란로 123' },
    { id: '2', name: '자주 가는 카페', address: '서울시 강남구 역삼동 234' },
  ]);

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-suite">안녕하세요, {userName}님</h1>
        <p className="mt-2 text-gray-600">오늘의 일정과 자주 찾는 장소를 확인하세요</p>
      </div>

      {/* 주요 메뉴 바로가기 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Link href="/group" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">그룹</span>
        </Link>
        
        <Link href="/schedule" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">일정</span>
        </Link>
        
        <Link href="/location" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">내장소</span>
        </Link>
        
        <Link href="/activelog" className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">활동로그</span>
        </Link>
      </div>

      {/* 다가오는 일정 */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">다가오는 일정</h2>
          <Link href="/schedule" className="text-sm text-indigo-600 hover:text-indigo-700">
            더보기
          </Link>
        </div>
        
        <div className="space-y-3">
          {recentSchedules.map(schedule => (
            <div key={schedule.id} className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900">{schedule.title}</h3>
              <div className="mt-2 flex items-start text-sm text-gray-500">
                <div className="flex-shrink-0 mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span>{schedule.date}</span>
              </div>
              <div className="mt-1 flex items-start text-sm text-gray-500">
                <div className="flex-shrink-0 mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <span>{schedule.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 즐겨찾는 장소 */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">즐겨찾는 장소</h2>
          <Link href="/location" className="text-sm text-indigo-600 hover:text-indigo-700">
            더보기
          </Link>
        </div>
        
        <div className="space-y-3">
          {favoriteLocations.map(location => (
            <div key={location.id} className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900">{location.name}</h3>
              <div className="mt-1 flex items-start text-sm text-gray-500">
                <div className="flex-shrink-0 mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <span>{location.address}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 