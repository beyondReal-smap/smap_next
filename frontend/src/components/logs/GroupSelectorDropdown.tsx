import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiLoader } from 'react-icons/fi';

interface Group {
  sgt_idx: number;
  sgt_title: string;
}

interface GroupSelectorDropdownProps {
  userGroups: Group[];
  selectedGroupId: number | null;
  isGroupSelectorOpen: boolean;
  isLoadingGroups: boolean;
  groupMemberCounts: Record<number, number>;
  onToggleSelector: () => void;
  onGroupSelect: (groupId: number) => void;
}

const GroupSelectorDropdown = memo(({ 
  userGroups, 
  selectedGroupId, 
  isGroupSelectorOpen, 
  isLoadingGroups,
  groupMemberCounts, 
  onToggleSelector, 
  onGroupSelect 
}: GroupSelectorDropdownProps) => {
  const selectedGroup = userGroups.find(g => g.sgt_idx === selectedGroupId);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleSelector}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/70 backdrop-blur-sm border rounded-xl text-sm font-medium hover:bg-white/90 hover:shadow-md transition-all duration-200"
        style={{ 
          borderColor: 'rgba(1, 19, 163, 0.2)',
        }}
        disabled={isLoadingGroups}
      >
        <span className="truncate text-gray-700">
          {isLoadingGroups 
            ? '로딩 중...' 
            : selectedGroup?.sgt_title || '그룹 선택'
          }
        </span>
        <div className="ml-2 flex-shrink-0">
          {isLoadingGroups ? (
            <FiLoader className="animate-spin text-blue-600" size={14} />
          ) : (
            <motion.div
              animate={{ rotate: isGroupSelectorOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <FiChevronDown className="text-gray-400" size={14} />
            </motion.div>
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
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto"
          >
            {userGroups.map((group) => (
              <motion.button
                key={group.sgt_idx}
                whileHover={{ backgroundColor: "rgba(99, 102, 241, 0.05)" }}
                onClick={() => {
                  if (selectedGroupId !== group.sgt_idx) {
                    onGroupSelect(group.sgt_idx);
                  }
                }}
                className={`w-full px-3 py-2 text-left text-xs focus:outline-none transition-colors ${
                  selectedGroupId === group.sgt_idx 
                    ? 'font-semibold bg-blue-50 text-blue-700' 
                    : 'text-gray-900 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{group.sgt_title}</span>
                  {selectedGroupId === group.sgt_idx && (
                    <span className="ml-2 text-blue-600">✓</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {groupMemberCounts[group.sgt_idx] || 0}명의 멤버
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

GroupSelectorDropdown.displayName = 'GroupSelectorDropdown';

export default GroupSelectorDropdown; 