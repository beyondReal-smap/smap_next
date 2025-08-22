'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, 
  FiMapPin, 
  FiSearch, 
  FiSave,
  FiTrash2,
  FiBell,
  FiBellOff,
  FiStar,
  FiEdit3
} from 'react-icons/fi';

// 타입 정의
interface LocationData {
  id: string; 
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  memo: string;
  favorite: boolean;
  notifications?: boolean;
}

interface NewLocationInput {
  id?: string;
  name: string;
  address: string;
  coordinates: [number, number];
  category?: string;
  memo?: string;
  favorite?: boolean;
  notifications?: boolean;
}

interface LocationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: LocationData | null;
  onSave: (location: NewLocationInput) => void;
  onDelete: (locationId: string) => void;
  onNotificationToggle: (location: LocationData) => void;
}

export default function LocationPanel({
  isOpen,
  onClose,
  selectedLocation,
  onSave,
  onDelete,
  onNotificationToggle
}: LocationPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newLocation, setNewLocation] = useState<NewLocationInput>({
    name: '',
    address: '',
    coordinates: [0, 0],
    category: '기타',
    memo: '',
    favorite: false,
    notifications: true
  });

  // 편집 모드 시작
  const startEditing = useCallback(() => {
    if (selectedLocation) {
      setNewLocation({
        id: selectedLocation.id,
        name: selectedLocation.name,
        address: selectedLocation.address,
        coordinates: selectedLocation.coordinates,
        category: selectedLocation.category,
        memo: selectedLocation.memo,
        favorite: selectedLocation.favorite,
        notifications: selectedLocation.notifications
      });
    }
    setIsEditing(true);
  }, [selectedLocation]);

  // 편집 모드 취소
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    if (selectedLocation) {
      setNewLocation({
        name: selectedLocation.name,
        address: selectedLocation.address,
        coordinates: selectedLocation.coordinates,
        category: selectedLocation.category,
        memo: selectedLocation.memo,
        favorite: selectedLocation.favorite,
        notifications: selectedLocation.notifications
      });
    }
  }, [selectedLocation]);

  // 저장
  const handleSave = useCallback(() => {
    if (!newLocation.name.trim() || !newLocation.address.trim()) {
      alert('장소 이름과 주소를 입력해주세요.');
      return;
    }
    
    onSave(newLocation);
    setIsEditing(false);
  }, [newLocation, onSave]);

  // 삭제
  const handleDelete = useCallback(() => {
    if (selectedLocation && confirm(`'${selectedLocation.name}' 장소를 삭제하시겠습니까?`)) {
      onDelete(selectedLocation.id);
      onClose();
    }
  }, [selectedLocation, onDelete, onClose]);

  // 알림 토글
  const handleNotificationToggle = useCallback(() => {
    if (selectedLocation) {
      onNotificationToggle(selectedLocation);
    }
  }, [selectedLocation, onNotificationToggle]);

  // 즐겨찾기 토글
  const handleFavoriteToggle = useCallback(() => {
    setNewLocation(prev => ({
      ...prev,
      favorite: !prev.favorite
    }));
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />
          
          {/* 패널 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? '장소 편집' : selectedLocation ? '장소 정보' : '새 장소 등록'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* 내용 */}
            <div className="p-6 space-y-6">
              {selectedLocation && !isEditing ? (
                // 장소 정보 표시 모드
                <div className="space-y-4">
                  {/* 장소 아이콘과 이름 */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                      <FiMapPin className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{selectedLocation.name}</h3>
                      <p className="text-sm text-gray-600">{selectedLocation.address}</p>
                    </div>
                  </div>

                  {/* 장소 정보 */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">카테고리</span>
                      <span className="text-sm font-medium text-gray-900">{selectedLocation.category}</span>
                    </div>
                    {selectedLocation.memo && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">메모</span>
                        <span className="text-sm font-medium text-gray-900">{selectedLocation.memo}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">즐겨찾기</span>
                      <FiStar className={`w-5 h-5 ${selectedLocation.favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                    </div>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex gap-3">
                    <button
                      onClick={startEditing}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FiEdit3 className="w-4 h-4" />
                      편집
                    </button>
                    <button
                      onClick={handleNotificationToggle}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors ${
                        selectedLocation.notifications
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {selectedLocation.notifications ? (
                        <>
                          <FiBellOff className="w-4 h-4" />
                          알림 끄기
                        </>
                      ) : (
                        <>
                          <FiBell className="w-4 h-4" />
                          알림 켜기
                        </>
                      )}
                    </button>
                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    장소 삭제
                  </button>
                </div>
              ) : (
                // 편집/등록 모드
                <div className="space-y-4">
                  {/* 장소 이름 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      장소 이름 *
                    </label>
                    <input
                      type="text"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="장소 이름을 입력하세요"
                    />
                  </div>

                  {/* 주소 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      주소 *
                    </label>
                    <input
                      type="text"
                      value={newLocation.address}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="주소를 입력하세요"
                    />
                  </div>

                  {/* 카테고리 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      카테고리
                    </label>
                    <select
                      value={newLocation.category}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="기타">기타</option>
                      <option value="음식점">음식점</option>
                      <option value="카페">카페</option>
                      <option value="쇼핑">쇼핑</option>
                      <option value="병원">병원</option>
                      <option value="학교">학교</option>
                      <option value="회사">회사</option>
                      <option value="집">집</option>
                    </select>
                  </div>

                  {/* 메모 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      메모
                    </label>
                    <textarea
                      value={newLocation.memo}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, memo: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="메모를 입력하세요"
                    />
                  </div>

                  {/* 옵션들 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="favorite"
                        checked={newLocation.favorite}
                        onChange={handleFavoriteToggle}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="favorite" className="text-sm text-gray-700">
                        즐겨찾기
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="notifications"
                        checked={newLocation.notifications}
                        onChange={(e) => setNewLocation(prev => ({ ...prev, notifications: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="notifications" className="text-sm text-gray-700">
                        알림
                      </label>
                    </div>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex gap-3 pt-4">
                    {isEditing && (
                      <button
                        onClick={cancelEditing}
                        className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FiSave className="w-4 h-4" />
                      {isEditing ? '수정' : '등록'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
