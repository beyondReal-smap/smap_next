import React, { useState } from 'react';
import { useAndroidPermissions } from '../hooks/useAndroidPermissions';
import { showPermissionRationale, openAppSettings } from '../utils/permissions';

interface AndroidPermissionRequestProps {
  onComplete?: () => void;
  showEssentialOnly?: boolean;
}

export const AndroidPermissionRequest: React.FC<AndroidPermissionRequestProps> = ({
  onComplete,
  showEssentialOnly = false
}) => {
  const {
    permissions,
    isLoading,
    error,
    requestEssential,
    requestPermission,
    hasPermission,
    canAskPermission,
    shouldShowRationale,
    essentialPermissionsGranted
  } = useAndroidPermissions();

  const [showRationale, setShowRationale] = useState<Record<string, boolean>>({});

  // 안드로이드 환경이 아닌 경우 렌더링하지 않음
  if (typeof window === 'undefined' || !window.Android) {
    return null;
  }

  // 필수 권한이 이미 승인된 경우 렌더링하지 않음
  if (essentialPermissionsGranted()) {
    return null;
  }

  // 권한이 로딩 중인 경우
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">권한을 확인하는 중...</span>
          </div>
        </div>
      </div>
    );
  }

  // 모든 필수 권한이 승인된 경우
  if (essentialPermissionsGranted()) {
    if (onComplete) {
      setTimeout(onComplete, 100);
    }
    return null;
  }

  // 필수 권한만 표시하는 경우
  if (showEssentialOnly) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            필수 권한이 필요합니다
          </h3>
          
          <div className="space-y-4">
            {/* 동작 권한 */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-700">동작 및 피트니스</h4>
                <p className="text-sm text-gray-500">사용자 활동을 추적하여 서비스를 개선합니다</p>
              </div>
              <button
                onClick={() => requestPermission('activity')}
                disabled={!canAskPermission('activity')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  canAskPermission('activity')
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {hasPermission('activity') ? '승인됨' : '요청'}
              </button>
            </div>

            {/* 위치 권한 */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-700">위치</h4>
                <p className="text-sm text-gray-500">현재 위치 기반 서비스를 제공합니다</p>
              </div>
              <button
                onClick={() => requestPermission('location')}
                disabled={!canAskPermission('location')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  canAskPermission('location')
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {hasPermission('location') ? '승인됨' : '요청'}
              </button>
            </div>
          </div>

          {/* 일괄 요청 버튼 */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={requestEssential}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700"
            >
              모든 필수 권한 요청
            </button>
          </div>

          {/* 설정으로 이동 버튼 */}
          {!canAskPermission('activity') || !canAskPermission('location') ? (
            <div className="mt-3">
              <button
                onClick={openAppSettings}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-md text-sm hover:bg-gray-700"
              >
                앱 설정에서 권한 허용
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // 모든 권한 표시
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          앱 권한 설정
        </h3>
        
        <div className="space-y-4">
          {/* 알림 권한 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-700">알림</h4>
              <p className="text-sm text-gray-500">중요한 정보를 받아볼 수 있습니다</p>
            </div>
            <button
              onClick={() => requestPermission('notifications')}
              disabled={!canAskPermission('notifications')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                canAskPermission('notifications')
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {hasPermission('notifications') ? '승인됨' : '요청'}
            </button>
          </div>

          {/* 카메라 권한 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-700">카메라</h4>
              <p className="text-sm text-gray-500">사진 촬영 및 QR 코드 스캔</p>
            </div>
            <button
              onClick={() => requestPermission('camera')}
              disabled={!canAskPermission('camera')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                canAskPermission('camera')
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {hasPermission('camera') ? '승인됨' : '요청'}
            </button>
          </div>

          {/* 저장소 권한 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-700">사진 및 파일</h4>
              <p className="text-sm text-gray-500">사진 저장 및 불러오기</p>
            </div>
            <button
              onClick={() => requestPermission('storage')}
              disabled={!canAskPermission('storage')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                canAskPermission('storage')
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {hasPermission('storage') ? '승인됨' : '요청'}
            </button>
          </div>

          {/* 동작 권한 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-700">동작 및 피트니스</h4>
              <p className="text-sm text-gray-500">사용자 활동을 추적하여 서비스를 개선합니다</p>
            </div>
            <button
              onClick={() => requestPermission('activity')}
              disabled={!canAskPermission('activity')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                canAskPermission('activity')
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {hasPermission('activity') ? '승인됨' : '요청'}
            </button>
          </div>

          {/* 위치 권한 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-700">위치</h4>
              <p className="text-sm text-gray-500">현재 위치 기반 서비스를 제공합니다</p>
            </div>
            <button
              onClick={() => requestPermission('location')}
              disabled={!canAskPermission('location')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                canAskPermission('location')
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {hasPermission('location') ? '승인됨' : '요청'}
            </button>
          </div>
        </div>

        {/* 권한 설명 토글 */}
        {Object.keys(showRationale).length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">권한 설명</h4>
            {Object.entries(showRationale).map(([permission, show]) => (
              show && (
                <p key={permission} className="text-sm text-blue-700 mb-1">
                  {showPermissionRationale(permission as any)}
                </p>
              )
            ))}
          </div>
        )}

        {/* 일괄 요청 버튼 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={requestEssential}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700"
          >
            필수 권한 요청 (동작, 위치)
          </button>
        </div>

        {/* 설정으로 이동 버튼 */}
        {Object.values(permissions || {}).some(p => !p.canAskAgain) && (
          <div className="mt-3">
            <button
              onClick={openAppSettings}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-md text-sm hover:bg-gray-700"
            >
              앱 설정에서 권한 허용
            </button>
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
