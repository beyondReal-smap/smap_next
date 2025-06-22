import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown } from 'react-icons/fi';

interface Group {
  sgt_idx: number;
  sgt_title: string;
}

interface GroupSelectorProps {
  userGroups: Group[];
  selectedGroupId: number | null;
  isGroupSelectorOpen: boolean;
  groupMemberCounts: Record<number, number>;
  onToggleSelector: () => void;
  onGroupSelect: (groupId: number) => void;
}

const GroupSelector = memo(({ 
  userGroups, 
  selectedGroupId, 
  isGroupSelectorOpen, 
  groupMemberCounts, 
  onToggleSelector, 
  onGroupSelect 
}: GroupSelectorProps) => {
  const selectedGroup = userGroups.find(g => g.sgt_idx === selectedGroupId);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleSelector}
        className="group-selector w-full px-4 py-3 rounded-xl flex items-center justify-between text-left focus:outline-none transition-all duration-300"
        style={{ borderColor: 'rgba(1, 19, 163, 0.2)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {selectedGroup?.sgt_title || '그룹을 선택하세요'}
          </div>
          <div className="text-xs text-gray-500">
            {selectedGroupId ? `${groupMemberCounts[selectedGroupId] || 0}명의 멤버` : '그룹을 선택해주세요'}
          </div>
        </div>
        <motion.div
          animate={{ rotate: isGroupSelectorOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <FiChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isGroupSelectorOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] overflow-hidden"
            style={{
              backgroundColor: '#ffffff',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            {userGroups.map((group) => (
              <motion.button
                key={group.sgt_idx}
                whileHover={{ backgroundColor: "rgba(99, 102, 241, 0.05)" }}
                onClick={() => {
                  if (selectedGroupId !== group.sgt_idx) {
                    onGroupSelect(group.sgt_idx);
                  }
                  onToggleSelector();
                }}
                className={`w-full px-3 py-2 text-left text-xs focus:outline-none transition-colors ${
                  selectedGroupId === group.sgt_idx 
                    ? 'font-semibold' 
                    : 'text-gray-900 hover:bg-blue-50'
                }`}
                style={selectedGroupId === group.sgt_idx 
                  ? { backgroundColor: 'rgba(1, 19, 163, 0.1)', color: '#0113A3' }
                  : {}
                }
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{group.sgt_title}</span>
                  {selectedGroupId === group.sgt_idx && (
                    <span className="ml-2" style={{ color: '#0113A3' }}>✓</span>
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

GroupSelector.displayName = 'GroupSelector';

export default GroupSelector; 