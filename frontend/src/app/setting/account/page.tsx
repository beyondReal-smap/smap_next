'use client';
import Header from '@/components/Header';
import React, { useState } from 'react';
import { FiUser, FiPhone, FiCalendar, FiUserCheck, FiLock, FiLogOut, FiTrash2, FiInfo } from 'react-icons/fi';
import Link from 'next/link';

const GENDER_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other', label: '선택안함' }
];

export default function AccountPage() {
  const [nickname, setNickname] = useState('길동이');
  const [name, setName] = useState('홍길동');
  const [phone, setPhone] = useState('010-1234-5678');
  const [birth, setBirth] = useState('1990-01-01');
  const [gender, setGender] = useState('male');
  const [originalNickname] = useState('길동이');

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Header title="계정설정" />
      <div className="px-2 flex-1 w-full mx-auto">
        <div style={{height: '50px'}} />
        {/* 기본 정보 카드 */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="flex items-center mb-5">
            <FiInfo className="text-indigo-500 w-6 h-6 mr-2" />
            <span className="text-lg font-extrabold text-gray-900">기본 정보</span>
          </div>
          <div className="mb-5">
            <label className="mb-1 font-semibold text-gray-700 flex items-center"><FiUser className="mr-1 text-blue-400" /> 닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 border-none"
              placeholder="닉네임을 입력하세요"
            />
          </div>
          <div className="mb-5">
            <label className="mb-1 font-semibold text-gray-700 flex items-center"><FiUserCheck className="mr-1 text-orange-400" /> 성명</label>
            <input
              type="text"
              value={name}
              className="w-full bg-gray-100 text-gray-400 rounded-xl px-4 py-3 text-base placeholder-gray-400 cursor-not-allowed border-none"
              placeholder="성명을 입력하세요"
              readOnly
            />
          </div>
          <div className="mb-5">
            <label className="mb-1 font-semibold text-gray-700 flex items-center"><FiPhone className="mr-1 text-green-500" /> 전화번호</label>
            <input
              type="tel"
              value={phone}
              className="w-full bg-gray-100 text-gray-400 rounded-xl px-4 py-3 text-base placeholder-gray-400 cursor-not-allowed border-none"
              placeholder="전화번호를 입력하세요"
              readOnly
            />
          </div>
          <div className="mb-5">
            <label className="mb-1 font-semibold text-gray-700 flex items-center"><FiCalendar className="mr-1 text-purple-500" /> 생년월일</label>
            <input
              type="date"
              value={birth}
              className="w-full bg-gray-100 text-gray-400 rounded-xl px-4 py-3 text-base placeholder-gray-400 cursor-not-allowed border-none"
              placeholder="생년월일"
              readOnly
            />
          </div>
          <div>
            <label className="mb-1 font-semibold text-gray-700 flex items-center"><FiUser className="mr-1 text-pink-400" /> 성별</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 border-none"
              disabled
            >
              {GENDER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button
            className={`w-full mt-6 py-3 rounded-2xl bg-indigo-600 text-white text-base font-normal shadow-md active:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
            disabled={nickname === originalNickname}
          >
            기본 정보 수정
          </button>
        </div>
        {/* 계정 관리 카드 */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="flex items-center mb-5">
            <FiLock className="text-indigo-500 w-6 h-6 mr-2" />
            <span className="text-lg font-extrabold text-gray-900">계정 관리</span>
          </div>
          <button className="w-full py-3 rounded-2xl bg-indigo-600 text-white text-base font-normal shadow-md active:bg-indigo-700 transition mb-3 flex items-center justify-center gap-2"
            type="button"
          >
            <Link href="/setting/account/password" className="flex items-center justify-center gap-2 w-full h-full">
              <FiLock className="w-5 h-5" /> 비밀번호 변경
            </Link>
          </button>
          <button className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 text-base font-normal shadow-md active:bg-gray-200 transition mb-3 flex items-center justify-center gap-2">
            <FiLogOut className="w-5 h-5" /> 로그아웃
          </button>
          <button className="w-full py-3 rounded-2xl bg-red-100 text-red-600 text-base font-normal shadow-md active:bg-red-200 transition flex items-center justify-center gap-2">
            <FiTrash2 className="w-5 h-5" /> 회원탈퇴
          </button>
        </div>
      </div>
    </div>
  );
} 