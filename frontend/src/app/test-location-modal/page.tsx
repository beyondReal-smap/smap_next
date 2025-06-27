'use client';

import React from 'react';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import LocationPermissionModal from '@/components/ui/LocationPermissionModal';

export default function TestLocationModalPage() {
  const {
    permissionState,
    showPermissionModal,
    requestPermission,
    openSettings,
    closePermissionModal
  } = useLocationPermission();

  const handleTestPermission = () => {
    console.log('권한 요청 테스트 시작');
    requestPermission();
  };

  const handleShowModal = () => {
    console.log('모달 강제 표시');
    // 모달을 강제로 표시하기 위해 상태를 직접 변경
    (window as any).__FORCE_SHOW_MODAL__ = true;
    // 페이지 새로고침으로 상태 초기화
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          위치 권한 모달 테스트
        </h1>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="font-semibold text-blue-800 mb-2">현재 권한 상태</h2>
            <p className="text-sm text-blue-700">
              상태: {permissionState.status}<br />
              로딩: {permissionState.isLoading ? '예' : '아니오'}<br />
              에러: {permissionState.error || '없음'}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h2 className="font-semibold text-green-800 mb-2">모달 상태</h2>
            <p className="text-sm text-green-700">
              모달 표시: {showPermissionModal ? '예' : '아니오'}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleTestPermission}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              위치 권한 요청 테스트
            </button>

            <button
              onClick={handleShowModal}
              className="w-full bg-green-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-600 transition-colors"
            >
              모달 강제 표시
            </button>

            <button
              onClick={() => {
                console.log('모달 상태 직접 변경');
                // 이 방법은 작동하지 않을 수 있지만 테스트용
                (window as any).__SHOW_MODAL__ = true;
              }}
              className="w-full bg-yellow-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-yellow-600 transition-colors"
            >
              모달 상태 직접 변경 (테스트)
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">사용법</h3>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>"위치 권한 요청 테스트" 버튼을 클릭</li>
              <li>권한이 거부되면 모달이 자동으로 표시됨</li>
              <li>"설정에서 권한 변경하기" 버튼으로 설정 이동</li>
            </ol>
          </div>
        </div>
      </div>

      {/* 위치 권한 모달 */}
      <LocationPermissionModal
        isOpen={showPermissionModal}
        onClose={closePermissionModal}
        onConfirm={requestPermission}
        onSettings={openSettings}
      />

      {/* 강제 모달 표시 (테스트용) */}
      {typeof window !== 'undefined' && (window as any).__FORCE_SHOW_MODAL__ && (
        <LocationPermissionModal
          isOpen={true}
          onClose={() => {
            (window as any).__FORCE_SHOW_MODAL__ = false;
            window.location.reload();
          }}
          onConfirm={() => {
            console.log('강제 모달에서 권한 요청');
            requestPermission();
          }}
          onSettings={openSettings}
        />
      )}
    </div>
  );
} 