'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { FaSearch as FaSearchSolid } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { Button } from '../../components/layout';
import ReactDOM from 'react-dom';

interface NewLocationInput {
  name: string;
  address: string;
  coordinates: [number, number];
  notifications?: boolean;
}

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  newLocation: NewLocationInput;
  setNewLocation: React.Dispatch<React.SetStateAction<NewLocationInput>>;
  onSave: () => void;
  portalContainer: Element | null;
}

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 50
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 50,
    transition: {
      duration: 0.2
    }
  }
};

export default function AddLocationModal({
  isOpen,
  onClose,
  newLocation,
  setNewLocation,
  onSave,
  portalContainer
}: AddLocationModalProps) {
  if (!portalContainer) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 modal-overlay"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 modal-content"
          >
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <HiSparkles className="mr-2 text-indigo-500" />
                새 위치 추가
              </h3>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <FiX size={20} />
              </motion.button>
            </div>
            
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">위치명</label>
                <input
                  type="text"
                  className="w-full py-3 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                  placeholder="장소 이름을 입력하세요"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    className="flex-1 py-3 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    value={newLocation.address}
                    onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                    placeholder="주소를 입력하세요"
                    required
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors mobile-button"
                  >
                    <FaSearchSolid size={16} />
                  </motion.button>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={onClose}
                  className="mobile-button"
                >
                  취소
                </Button>
                <Button 
                  type="button" 
                  onClick={onSave}
                  className="mobile-button"
                >
                  저장
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer
  );
} 