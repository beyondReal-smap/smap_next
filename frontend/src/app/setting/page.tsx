'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Header from '@/components/Header';
import Image from 'next/image';
// AppLayout은 App Router에서 불필요합니다. (authenticated) 라우트 그룹이 이미 레이아웃을 사용함
// import { AppLayout } from '../components/layout';

// 설정 스키마 정의
const settingsSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  nickname: z.string().min(1, '닉네임을 입력해주세요.'),
  gender: z.enum(['male', 'female', 'other']),
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  phone: z.string().regex(/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/, '유효한 전화번호를 입력해주세요.')
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// 모의 데이터
const MOCK_USER_SETTINGS = {
  name: '홍길동',
  nickname: '길동이',
  gender: 'male' as const,
  email: 'user@example.com',
  phone: '010-1234-5678'
};

// 성별 옵션
const GENDER_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other', label: '선택안함' }
];

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: MOCK_USER_SETTINGS
  });

  // 사용자 설정 가져오기
  useEffect(() => {
    // 모의 데이터 로드
    reset(MOCK_USER_SETTINGS);
  }, [reset]);

  // 설정 저장
  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    setSaveSuccess(false);
    
    try {
      // 모의 저장 (API 연동 전 테스트용)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('설정 저장 중 오류가 발생했습니다.', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 프로필 mock 데이터
  const profile = {
    avatar: '/images/avatar1.png', // public 폴더에 이미지가 있다고 가정
    name: 'jin(진)',
    plan: '유료플랜 사용중',
    phone: '010-2956-5435',
  };

  // 메뉴 데이터
  const menuSections = [
    {
      items: [
        { label: '계정설정', href: '/setting/account' },
        { label: '매뉴얼', href: '/setting/manual' },
        { label: '약관 및 동의 관리', href: '/setting/terms' },
      ]
    },
    {
      items: [
        { label: '1:1 문의', href: '/setting/inquiry' },
        { label: '공지사항', href: '/setting/notice' },
      ]
    },
    {
      items: [
        { label: '쿠폰 입력', href: '/setting/coupon' },
        { label: '추천인 입력', href: '/setting/referrer' },
        { label: '구매 내역', href: '/setting/purchase' },
        { label: '구독 관리', href: '/setting/subscription' },
      ]
    }
  ];

  // 프로필 이미지 관련 상태 및 ref
  const [profileImg, setProfileImg] = useState(profile.avatar);
  const [showSheet, setShowSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setProfileImg(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    setShowSheet(false);
  };

  // 카메라/앨범 선택 트리거
  const handleSelect = (mode: 'camera' | 'album') => {
    if (fileInputRef.current) {
      if (mode === 'camera') {
        fileInputRef.current.setAttribute('capture', 'environment');
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
  };

  return (
    <div className="bg-[#fff] min-h-screen pb-10">
      <Header title="설정" />
      {/* 프로필 영역 */}
      <div className="flex flex-col items-center pt-6 pb-4">
        <div className="relative">
          <button type="button" onClick={() => setShowSheet(true)}>
            <Image
              src={profileImg}
              alt="프로필 이미지"
              width={80}
              height={80}
              className="rounded-full border border-gray-200 bg-gray-100"
            />
            <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 border border-gray-200">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M4 13V16H7L16.29 6.71C16.68 6.32 16.68 5.69 16.29 5.3L14.7 3.71C14.31 3.32 13.68 3.32 13.29 3.71L4 13ZM17.71 4.29C18.1 4.68 18.1 5.31 17.71 5.7L16.3 7.11L12.89 3.7L14.3 2.29C14.69 1.9 15.32 1.9 15.71 2.29L17.71 4.29Z"></path></svg>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <div className="mt-3 text-lg font-bold">{profile.name}</div>
        <div className="text-xs text-gray-500 mt-1">{profile.plan}</div>
        <div className="text-sm text-indigo-600 font-medium mt-1">{profile.phone}</div>
      </div>

      {/* 액션시트 모달 */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30" onClick={() => setShowSheet(false)}>
          <div className="w-full max-w-xs bg-white rounded-2xl p-6 pb-4 shadow-lg flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-semibold text-center mb-6">프로필 사진 변경</div>
            <button
              className="w-full py-4 mb-2 rounded-2xl bg-pink-600 text-white text-base font-normal shadow-sm border border-pink-600 hover:bg-indigo-700 active:bg-indigo-800 transition"
              onClick={() => handleSelect('camera')}
            >
              카메라로 촬영
            </button>
            <button
              className="w-full py-4 mb-2 rounded-2xl bg-indigo-600 text-white text-base font-normal shadow-sm border border-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition"
              onClick={() => handleSelect('album')}
            >
              앨범에서 선택
            </button>
            <button
              className="w-full py-4 mt-2 rounded-2xl bg-gray-100 text-gray-700 text-base font-normal shadow-sm active:bg-gray-200 transition"
              onClick={() => setShowSheet(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 메뉴 리스트 */}
      <div className="space-y-4 px-3">
        {menuSections.map((section, idx) => (
          <div key={idx} className="bg-[#f5f6f7] rounded-2xl shadow-sm p-1">
            {section.items.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-4 py-4 ${i !== section.items.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="text-[16px] text-black font-medium">{item.label}</span>
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
} 