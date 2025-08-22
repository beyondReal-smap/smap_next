'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocationData } from '../hooks/useLocationUI';

interface LocationInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationData;
  onEdit: () => void;
  onDelete: (location: LocationData) => void;
  onSave: (location: LocationData) => void;
  isEditing: boolean;
  onCancelEdit: () => void;
}

export const LocationInfoPanel: React.FC<LocationInfoPanelProps> = ({
  isOpen,
  onClose,
  location,
  onEdit,
  onDelete,
  onSave,
  isEditing,
  onCancelEdit
}) => {
  const [editedLocation, setEditedLocation] = useState<LocationData>(location);

  // 편집 모드에서 위치 정보 변경 처리
  const handleInputChange = (field: string, value: any) => {
    setEditedLocation((prev: LocationData) => ({
      ...prev,
      [field]: value
    }));
  };

  // 저장 처리
  const handleSave = () => {
    onSave(editedLocation);
  };

  // 편집 취소 시 원래 데이터로 복원
  const handleCancelEdit = () => {
    setEditedLocation(location);
    onCancelEdit();
  };

  // 삭제 처리
  const handleDelete = () => {
    onDelete(location);
  };

  if (!location) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          <div className="p-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {isEditing ? '위치 편집' : '위치 정보'}
              </h3>
              <div className="flex items-center space-x-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={onEdit}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="편집"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={handleDelete}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      취소
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 위치 정보 내용 */}
            <div className="space-y-4">
              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedLocation.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="위치 이름을 입력하세요"
                  />
                ) : (
                  <p className="text-gray-900">{location.name || '이름 없음'}</p>
                )}
              </div>

              {/* 주소 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주소
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedLocation.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="주소를 입력하세요"
                  />
                ) : (
                  <p className="text-gray-900">{location.address || '주소 없음'}</p>
                )}
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리
                </label>
                {isEditing ? (
                  <select
                    value={editedLocation.category || '기타'}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="음식점">음식점</option>
                    <option value="카페">카페</option>
                    <option value="쇼핑">쇼핑</option>
                    <option value="교통">교통</option>
                    <option value="의료">의료</option>
                    <option value="기타">기타</option>
                  </select>
                ) : (
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {location.category || '기타'}
                  </span>
                )}
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모
                </label>
                {isEditing ? (
                  <textarea
                    value={editedLocation.memo || ''}
                    onChange={(e) => handleInputChange('memo', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="메모를 입력하세요"
                  />
                ) : (
                  <p className="text-gray-900">{location.memo || '메모 없음'}</p>
                )}
              </div>

              {/* 즐겨찾기 및 알림 설정 */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="favorite"
                    checked={editedLocation.favorite || false}
                    onChange={(e) => handleInputChange('favorite', e.target.checked)}
                    disabled={!isEditing}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="favorite" className="ml-2 text-sm text-gray-700">
                    즐겨찾기
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="notifications"
                    checked={editedLocation.notifications !== false}
                    onChange={(e) => handleInputChange('notifications', e.target.checked)}
                    disabled={!isEditing}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="notifications" className="ml-2 text-sm text-gray-700">
                    알림
                  </label>
                </div>
              </div>

              {/* 좌표 정보 (읽기 전용) */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  좌표
                </label>
                <p className="text-sm text-gray-600">
                  위도: {location.coordinates?.[0]?.toFixed(6) || 'N/A'}, 
                  경도: {location.coordinates?.[1]?.toFixed(6) || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 