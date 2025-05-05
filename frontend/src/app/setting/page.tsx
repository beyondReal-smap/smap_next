'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// AppLayout은 App Router에서 불필요합니다. (authenticated) 라우트 그룹이 이미 레이아웃을 사용함
// import { AppLayout } from '../components/layout';

// 설정 스키마 정의
const settingsSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  phone: z.string().regex(/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/, '유효한 전화번호를 입력해주세요.'),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean()
  }),
  language: z.enum(['ko', 'en', 'ja', 'zh']),
  theme: z.enum(['light', 'dark', 'system']),
  timezone: z.string()
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// 모의 데이터
const MOCK_USER_SETTINGS = {
  name: '홍길동',
  email: 'user@example.com',
  phone: '010-1234-5678',
  notifications: {
    email: true,
    push: true,
    sms: false
  },
  language: 'ko' as const,
  theme: 'light' as const,
  timezone: 'Asia/Seoul'
};

// 타임존 목록
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Seoul', label: '서울 (GMT+9)' },
  { value: 'Asia/Tokyo', label: '도쿄 (GMT+9)' },
  { value: 'America/New_York', label: '뉴욕 (GMT-5/GMT-4)' },
  { value: 'Europe/London', label: '런던 (GMT+0/GMT+1)' },
  { value: 'Europe/Paris', label: '파리 (GMT+1/GMT+2)' }
];

// 언어 목록
const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh', label: '중국어' }
];

// 테마 목록
const THEME_OPTIONS = [
  { value: 'light', label: '라이트 모드' },
  { value: 'dark', label: '다크 모드' },
  { value: 'system', label: '시스템 설정 따름' }
];

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  
  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: MOCK_USER_SETTINGS
  });

  // 사용자 설정 가져오기
  useEffect(() => {
    // 실제 구현 시에는 API 호출로 데이터를 가져옵니다
    /*
    const fetchUserSettings = async () => {
      try {
        const response = await fetch('/api/user/settings');
        const data = await response.json();
        if (response.ok) {
          reset(data.settings);
        }
      } catch (error) {
        console.error('사용자 설정을 가져오는 중 오류가 발생했습니다.', error);
      }
    };
    
    fetchUserSettings();
    */
    
    // 모의 데이터 로드
    reset(MOCK_USER_SETTINGS);
  }, [reset]);

  // 설정 저장
  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    setSaveSuccess(false);
    
    try {
      // 실제 구현 시에는 API 호출로 데이터를 저장합니다
      /*
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('설정을 저장하는 중 오류가 발생했습니다.');
      }
      */
      
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
  
  const tabs = [
    { id: 'account', label: '계정 설정' },
    { id: 'notifications', label: '알림 설정' },
    { id: 'preferences', label: '환경 설정' }
  ];

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-suite">설정</h1>
        <p className="mt-2 text-gray-600">계정 및 애플리케이션 설정을 관리하세요</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`py-4 px-6 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* 계정 설정 */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    이름
                  </label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        id="name"
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          errors.name ? 'border-red-500' : ''
                        }`}
                      />
                    )}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
                  </label>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="email"
                        id="email"
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          errors.email ? 'border-red-500' : ''
                        }`}
                      />
                    )}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    전화번호
                  </label>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="tel"
                        id="phone"
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          errors.phone ? 'border-red-500' : ''
                        }`}
                      />
                    )}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">보안 설정</h3>
                <div className="space-y-4">
                  <div>
                    <Link
                      href="/setting/password"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      비밀번호 변경
                    </Link>
                  </div>
                  <div>
                    <Link
                      href="/setting/security"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      보안 설정
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 알림 설정 */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">알림 설정</h3>
              <fieldset className="space-y-5">
                <legend className="sr-only">알림 설정</legend>
                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <Controller
                      name="notifications.email"
                      control={control}
                      render={({ field: { onChange, onBlur, value, ref } }) => (
                        <input
                          id="notifications.email"
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          checked={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          ref={ref}
                        />
                      )}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="notifications.email" className="font-medium text-gray-700">
                      이메일 알림
                    </label>
                    <p className="text-gray-500">새 일정, 일정 변경, 알림 등의 정보를 이메일로 받습니다.</p>
                  </div>
                </div>

                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <Controller
                      name="notifications.push"
                      control={control}
                      render={({ field: { onChange, onBlur, value, ref } }) => (
                        <input
                          id="notifications.push"
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          checked={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          ref={ref}
                        />
                      )}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="notifications.push" className="font-medium text-gray-700">
                      푸시 알림
                    </label>
                    <p className="text-gray-500">웹 브라우저 또는 모바일 앱에서 푸시 알림을 받습니다.</p>
                  </div>
                </div>

                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <Controller
                      name="notifications.sms"
                      control={control}
                      render={({ field: { onChange, onBlur, value, ref } }) => (
                        <input
                          id="notifications.sms"
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          checked={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          ref={ref}
                        />
                      )}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="notifications.sms" className="font-medium text-gray-700">
                      SMS 알림
                    </label>
                    <p className="text-gray-500">긴급 알림이나 중요 일정에 대한 SMS 알림을 받습니다.</p>
                  </div>
                </div>
              </fieldset>

              <div className="border-t border-gray-200 pt-4">
                <Link
                  href="/setting/notifications"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  상세 알림 설정 →
                </Link>
              </div>
            </div>
          )}

          {/* 환경 설정 */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">환경 설정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                    언어
                  </label>
                  <Controller
                    name="language"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        id="language"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>

                <div>
                  <label htmlFor="theme" className="block text-sm font-medium text-gray-700 mb-1">
                    테마
                  </label>
                  <Controller
                    name="theme"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        id="theme"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {THEME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                    시간대
                  </label>
                  <Controller
                    name="timezone"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        id="timezone"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {TIMEZONE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="mt-8 flex items-center justify-end space-x-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => reset(MOCK_USER_SETTINGS)}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || !isDirty}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  저장 중...
                </>
              ) : '저장'}
            </button>
          </div>

          {/* 성공 메시지 */}
          {saveSuccess && (
            <div className="mt-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm">설정이 성공적으로 저장되었습니다.</p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
} 