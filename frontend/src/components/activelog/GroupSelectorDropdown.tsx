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
        className="w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl text-sm font-medium hover:bg-gray-50 hover:shadow-md transition-all duration-200"
        style={{ borderColor: 'rgba(1, 19, 163, 0.2)' }}
        disabled={isLoadingGroups}
      >
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {isLoadingGroups
              ? '로딩 중...'
              : selectedGroup?.sgt_title || '그룹 선택'}
          </div>
          <div className="text-xs text-gray-500">
            {selectedGroupId ? `${groupMemberCounts[selectedGroupId] || 0}명의 멤버` : '그룹을 선택해주세요'}
          </div>
        </div>
        <motion.div
          animate={{ rotate: isGroupSelectorOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <FiChevronDown className="text-gray-400" size={18} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isGroupSelectorOpen && (userGroups?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 z-[9999] mt-1 bg-white !bg-white !opacity-100 border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto"
            style={{
              backgroundColor: '#fff',
              opacity: 1,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
            }}
          >
            {(userGroups ?? []).map((group) => (
              <button
                key={group.sgt_idx}
                type="button"
                className={`w-full flex items-center justify-between px-4 py-3 bg-white border-b last:border-b-0 text-sm font-medium hover:bg-gray-50 transition-all duration-150 ${selectedGroupId === group.sgt_idx ? 'font-bold text-blue-700' : 'text-gray-900'}`}
                onClick={() => onGroupSelect(group.sgt_idx)}
              >
                <span className="truncate">{group.sgt_title}</span>
                <span className="ml-2 text-xs text-gray-500">{groupMemberCounts[group.sgt_idx] ? `${groupMemberCounts[group.sgt_idx]}명` : ''}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

GroupSelectorDropdown.displayName = 'GroupSelectorDropdown';

export default GroupSelectorDropdown; 