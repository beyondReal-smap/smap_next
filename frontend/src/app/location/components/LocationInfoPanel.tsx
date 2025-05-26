'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiBell, FiBellOff, FiTrash2, FiHeart } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { Button } from '../../components/layout';

interface NewLocationInput {
  name: string;
  address: string;
  coordinates: [number, number];
  notifications?: boolean;
}

interface LocationInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isEditingPanel: boolean;
  newLocation: NewLocationInput;
  setNewLocation: React.Dispatch<React.SetStateAction<NewLocationInput>>;
  onSave: () => void;
  onDelete?: () => void;
}

export default function LocationInfoPanel({
  isOpen,
  onClose,
  isEditingPanel,
  newLocation,
  setNewLocation,
  onSave,
  onDelete
}: LocationInfoPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="location-info-panel open"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <HiSparkles className="mr-2 text-indigo-500" />
              {isEditingPanel ? "장소 정보" : "새 장소 등록"}
            </h3>
            <div className="flex items-center space-x-2">
              {isEditingPanel && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    const newNotificationStatus = !newLocation.notifications;
                    setNewLocation(prev => ({ ...prev, notifications: newNotificationStatus }));
                  }}
                  className={`p-2 rounded-full transition-colors ${
                    newLocation.notifications 
                      ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' 
                      : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {newLocation.notifications ? <FiBell size={18} /> : <FiBellOff size={18} />}
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <FiX size={20} />
              </motion.button>
            </div>
          </div>

          {isEditingPanel ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                <p className="text-lg font-semibold text-gray-800 mb-2">{newLocation.name}</p>
                <p className="text-sm text-gray-600">{newLocation.address || '주소 정보 없음'}</p>
              </div>
              <div className="flex space-x-3">
                {onDelete && (
                  <Button 
                    variant="danger" 
                    onClick={onDelete} 
                    className="flex-1 mobile-button"
                  >
                    <FiTrash2 className="mr-2" />
                    삭제
                  </Button>
                )}
                <Button 
                  variant="secondary" 
                  onClick={onClose} 
                  className="flex-1 mobile-button"
                >
                  닫기
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-indigo-600 mb-2">
                    선택한 위치 주소
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                    {newLocation.address || '지도를 클릭하거나 검색하세요.'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-600 mb-2">
                    장소 이름
                  </label>
                  <input
                    type="text"
                    className="w-full py-3 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                    placeholder="이 장소에 대한 나만의 이름을 지어주세요."
                    value={newLocation.name}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-2">
                <Button 
                  variant="secondary" 
                  onClick={onClose} 
                  className="flex-1 mobile-button"
                >
                  닫기
                </Button>
                <Button 
                  variant="primary" 
                  onClick={onSave} 
                  className="flex-1 mobile-button"
                >
                  <FiHeart className="mr-2" />
                  내 장소 등록
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
} 