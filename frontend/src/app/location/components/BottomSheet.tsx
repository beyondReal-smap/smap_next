'use client';

import React from 'react';
import { motion } from 'framer-motion';
import GroupMemberSection from './GroupMemberSection';
import PlacesSection from './PlacesSection';
import { Group } from '@/services/groupService';

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
  photo: string | null;
  isSelected: boolean;
  location: { lat: number; lng: number };
  schedules: any[];
  savedLocations: LocationData[];
  mt_gender?: number | null;
  original_index: number;
}

interface BottomSheetProps {
  bottomSheetState: 'collapsed' | 'expanded';
  onToggle: () => void;
  groupMembers: GroupMember[];
  isLoading: boolean;
  isFetchingGroupMembers: boolean;
  userGroups: Group[];
  selectedGroupId: number | null;
  isLoadingGroups: boolean;
  isGroupSelectorOpen: boolean;
  selectedMemberSavedLocations: LocationData[] | null;
  selectedLocationId: string | null;
  activeView: string;
  onMemberSelect: (memberId: string) => void;
  onGroupSelect: (groupId: number) => void;
  setIsGroupSelectorOpen: (open: boolean) => void;
  onLocationClick: (locationId: string) => void;
  setActiveView: (view: string) => void;
  getDefaultImage: (gender: number | null | undefined, index: number) => string;
  itemVariants: any;
  bottomSheetRef: React.RefObject<HTMLDivElement>;
}

export default function BottomSheet({
  bottomSheetState,
  onToggle,
  groupMembers,
  isLoading,
  isFetchingGroupMembers,
  userGroups,
  selectedGroupId,
  isLoadingGroups,
  isGroupSelectorOpen,
  selectedMemberSavedLocations,
  selectedLocationId,
  activeView,
  onMemberSelect,
  onGroupSelect,
  setIsGroupSelectorOpen,
  onLocationClick,
  setActiveView,
  getDefaultImage,
  itemVariants,
  bottomSheetRef
}: BottomSheetProps) {
  return (
    <motion.div
      ref={bottomSheetRef}
      initial={{ y: "100%" }}
      animate={{ y: bottomSheetState === 'collapsed' ? "calc(100% - 120px)" : "58%" }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="bottom-sheet hide-scrollbar"
      onTouchStart={(e) => {
        // 터치 시작 로직
      }}
    >
      <motion.div 
        className="bottom-sheet-handle"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggle}
      />
      
      <div className="px-6 pb-4">
        {/* 그룹 멤버 섹션 */}
        <GroupMemberSection
          groupMembers={groupMembers}
          isLoading={isLoading}
          isFetchingGroupMembers={isFetchingGroupMembers}
          userGroups={userGroups}
          selectedGroupId={selectedGroupId}
          isLoadingGroups={isLoadingGroups}
          isGroupSelectorOpen={isGroupSelectorOpen}
          onMemberSelect={onMemberSelect}
          onGroupSelect={onGroupSelect}
          setIsGroupSelectorOpen={setIsGroupSelectorOpen}
          getDefaultImage={getDefaultImage}
          itemVariants={itemVariants}
        />

        {/* 장소 섹션 */}
        <PlacesSection
          groupMembers={groupMembers}
          selectedMemberSavedLocations={selectedMemberSavedLocations}
          selectedLocationId={selectedLocationId}
          onLocationClick={onLocationClick}
          itemVariants={itemVariants}
        />

        {/* 뷰 인디케이터 */}
        <div className="flex justify-center items-center my-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveView('selectedMemberPlaces')}
            className={`w-3 h-3 rounded-full mx-2 transition-all duration-300 ${
              activeView === 'selectedMemberPlaces' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 scale-125' 
                : 'bg-gray-300'
            }`}
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveView('otherMembersPlaces')}
            className={`w-3 h-3 rounded-full mx-2 transition-all duration-300 ${
              activeView === 'otherMembersPlaces' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 scale-125' 
                : 'bg-gray-300'
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
} 