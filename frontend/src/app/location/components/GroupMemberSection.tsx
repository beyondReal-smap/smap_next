'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiLoader, FiSettings, FiChevronDown } from 'react-icons/fi';
import Link from 'next/link';
import { Group } from '@/services/groupService';

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  mt_gender?: number | null;
  original_index: number;
}

interface GroupMemberSectionProps {
  groupMembers: GroupMember[];
  isLoading: boolean;
  isFetchingGroupMembers: boolean;
  userGroups: Group[];
  selectedGroupId: number | null;
  isLoadingGroups: boolean;
  isGroupSelectorOpen: boolean;
  onMemberSelect: (memberId: string) => void;
  onGroupSelect: (groupId: number) => void;
  setIsGroupSelectorOpen: (open: boolean) => void;
  getDefaultImage: (gender: number | null | undefined, index: number) => string;
  itemVariants: any;
}

export default function GroupMemberSection({
  groupMembers,
  isLoading,
  isFetchingGroupMembers,
  userGroups,
  selectedGroupId,
  isLoadingGroups,
  isGroupSelectorOpen,
  onMemberSelect,
  onGroupSelect,
  setIsGroupSelectorOpen,
  getDefaultImage,
  itemVariants
}: GroupMemberSectionProps) {
  return (
    <motion.div
      variants={itemVariants}
      className="content-section members-section"
    >
      <div className="flex justify-between items-center section-title">
        <div className="flex items-center space-x-3">
          <FiUsers className="text-green-600" size={20} />
          <span>그룹 멤버</span>
          {isFetchingGroupMembers && <FiLoader className="animate-spin text-indigo-500" size={18}/>}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 그룹 선택 드롭다운 */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsGroupSelectorOpen(!isGroupSelectorOpen)}
              className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl text-sm hover:from-indigo-100 hover:to-purple-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[120px] transition-all"
              disabled={isLoadingGroups}
            >
              <span className="truncate text-gray-700 font-medium">
                {isLoadingGroups 
                  ? '로딩 중...' 
                  : userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹 선택'
                }
              </span>
              <div className="ml-2 flex-shrink-0">
                {isLoadingGroups ? (
                  <FiLoader className="animate-spin text-gray-400" size={14} />
                ) : (
                  <FiChevronDown className={`text-gray-400 transition-transform duration-200 ${isGroupSelectorOpen ? 'rotate-180' : ''}`} size={14} />
                )}
              </div>
            </motion.button>

            <AnimatePresence>
              {isGroupSelectorOpen && userGroups.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full right-0 z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto min-w-[160px] backdrop-blur-lg"
                >
                  {userGroups.map((group) => (
                    <motion.button
                      key={group.sgt_idx}
                      whileHover={{ backgroundColor: "rgba(99, 102, 241, 0.05)" }}
                      onClick={() => {
                        onGroupSelect(group.sgt_idx);
                        setIsGroupSelectorOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm focus:outline-none transition-colors ${
                        selectedGroupId === group.sgt_idx 
                          ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                          : 'text-gray-900 hover:bg-indigo-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{group.sgt_title || `그룹 ${group.sgt_idx}`}</span>
                        {selectedGroupId === group.sgt_idx && (
                          <span className="text-indigo-500 ml-2">✓</span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href="/group">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-indigo-700 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all mobile-button"
            >
              <FiSettings className="mr-2" size={16} />
              그룹 관리
            </motion.button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="shimmer w-full h-16 rounded-lg mb-4"></div>
          <span className="text-sm text-gray-500">멤버 정보를 불러오는 중...</span>
        </div>
      ) : groupMembers.length > 0 ? (
        <div className="flex flex-row flex-nowrap justify-start items-center gap-x-4 overflow-x-auto hide-scrollbar px-2 py-3">
          {groupMembers.map((member, index) => (
            <motion.div
              key={member.id}
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center flex-shrink-0"
            >
              <motion.button
                onClick={() => onMemberSelect(member.id)}
                className={`member-card ${member.isSelected ? 'selected' : ''} flex flex-col items-center focus:outline-none`}
              >
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex-shrink-0 flex items-center justify-center overflow-hidden border-3 transition-all duration-300 ${
                  member.isSelected 
                    ? 'border-indigo-500 ring-4 ring-indigo-200 shadow-lg' 
                    : 'border-transparent hover:border-indigo-300'
                }`}>
                  <img 
                    src={member.photo ?? getDefaultImage(member.mt_gender, member.original_index)} 
                    alt={member.name} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = getDefaultImage(member.mt_gender, member.original_index);
                      target.onerror = null; 
                    }}
                  />
                </div>
                <span className={`block text-sm font-medium mt-2 transition-colors ${
                  member.isSelected ? 'text-indigo-700' : 'text-gray-700'
                }`}>
                  {member.name}
                </span>
              </motion.button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <FiUsers className="text-gray-400" size={24} />
          </div>
          <span className="text-sm text-gray-500">그룹에 참여한 멤버가 없습니다</span>
        </div>
      )}
    </motion.div>
  );
} 