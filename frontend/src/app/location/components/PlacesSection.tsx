'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiMapPin, FiFilter, FiBell, FiBellOff } from 'react-icons/fi';

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

interface GroupMember {
  id: string;
  name: string;
  isSelected: boolean;
}

interface PlacesSectionProps {
  groupMembers: GroupMember[];
  selectedMemberSavedLocations: LocationData[] | null;
  selectedLocationId: string | null;
  onLocationClick: (locationId: string) => void;
  itemVariants: any;
}

export default function PlacesSection({
  groupMembers,
  selectedMemberSavedLocations,
  selectedLocationId,
  onLocationClick,
  itemVariants
}: PlacesSectionProps) {
  const selectedMember = groupMembers.find(m => m.isSelected);

  return (
    <motion.div
      variants={itemVariants}
      className="content-section places-section"
    >
      <div className="flex justify-between items-center section-title">
        <div className="flex items-center space-x-3">
          <FiMapPin className="text-pink-600" size={20} />
          <span>
            {selectedMember?.name 
              ? `${selectedMember.name}의 장소` 
              : '저장된 장소'
            }
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 text-gray-400 hover:text-pink-600 rounded-lg hover:bg-pink-50 transition-colors"
          >
            <FiFilter size={16} />
          </motion.button>
        </div>
      </div>

      {selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0 ? (
        <div className="flex overflow-x-auto space-x-4 pb-3 hide-scrollbar">
          {selectedMemberSavedLocations.map((location, index) => (
            <motion.div
              key={location.id}
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`location-card flex-shrink-0 w-52 bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 cursor-pointer border border-gray-100 ${
                selectedLocationId === location.id ? 'selected ring-2 ring-indigo-300' : ''
              }`}
              onClick={() => onLocationClick(location.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center min-w-0 flex-1">
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                    <FiMapPin className="text-pink-600" size={16} />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-800 truncate">
                    {location.name || '제목 없음'}
                  </h4>
                </div>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="flex-shrink-0 ml-2"
                >
                  {location.notifications ? (
                    <FiBell size={14} className="text-yellow-500" />
                  ) : (
                    <FiBellOff size={14} className="text-gray-400" />
                  )}
                </motion.div>
              </div>
              <p className="text-xs text-gray-500 truncate">
                {location.address || '주소 정보 없음'}
              </p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FiMapPin className="text-gray-400" size={24} />
          </div>
          <p className="text-gray-500">
            {selectedMember?.name 
              ? `${selectedMember.name}님이 등록한 장소가 없습니다.` 
              : '등록된 장소가 없습니다.'
            }
          </p>
        </div>
      )}
    </motion.div>
  );
} 