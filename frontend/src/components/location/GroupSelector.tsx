import React, { memo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown } from 'react-icons/fi';
import { createPortal } from 'react-dom';

// 글로벌 스타일 추가
const dropdownStyles = `
  .group-selector-dropdown {
    background-color: #ffffff !important;
    opacity: 1 !important;
    border: 3px solid #000000 !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
    z-index: 999999 !important;
    position: fixed !important;
  }
  .group-selector-item {
    background-color: #ffffff !important;
    opacity: 1 !important;
    border-bottom: 2px solid #000000 !important;
  }
  .group-selector-item:hover {
    background-color: #ff0000 !important;
  }
  .group-selector-item.selected {
    background-color: #0000ff !important;
    color: #ffffff !important;
    font-weight: 600 !important;
  }
`;

interface Group {
  sgt_idx: number;
  sgt_title: string;
}

interface GroupSelectorProps {
  userGroups: Group[];
  selectedGroupId: number | null;
  isGroupSelectorOpen: boolean;
  groupMemberCounts: Record<number, number>;
  onOpen: () => void;
  onClose: () => void;
  onGroupSelect: (groupId: number) => void;
}

const DropdownPortal = ({
  children,
  target,
  onClose,
}: {
  children: React.ReactNode;
  target: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        target.current && !target.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    
    const calculatePosition = () => {
      if (target.current) {
        const rect = target.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    calculatePosition();
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [target, onClose]);

  if (!position) return null;

  return createPortal(
    <motion.div
      ref={dropdownRef}
      onMouseDown={(e) => e.stopPropagation()}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.1 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="absolute rounded-xl z-[99999] overflow-hidden bg-white shadow-2xl border border-gray-200/80"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: '40vh',
        overflowY: 'auto'
      }}
    >
      {children}
    </motion.div>,
    document.body
  );
};

const GroupSelector = memo(({ 
  userGroups, 
  selectedGroupId, 
  isGroupSelectorOpen, 
  groupMemberCounts, 
  onOpen,
  onClose,
  onGroupSelect 
}: GroupSelectorProps) => {
  const selectedGroup = userGroups.find(g => g.sgt_idx === selectedGroupId);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={(e) => {
          e.stopPropagation();
          isGroupSelectorOpen ? onClose() : onOpen();
        }}
        className="group-selector w-full px-4 py-3 rounded-xl flex items-center justify-between text-left focus:outline-none transition-all duration-300 bg-white/50 border"
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
        {isMounted && isGroupSelectorOpen && (
          <DropdownPortal target={buttonRef} onClose={onClose}>
            {userGroups.map((group) => (
              <motion.button
                key={group.sgt_idx}
                whileHover={{ backgroundColor: "rgba(239, 246, 255, 1)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onGroupSelect(group.sgt_idx);
                }}
                className={`w-full px-4 py-3 text-left text-sm focus:outline-none transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0 ${
                  selectedGroupId === group.sgt_idx 
                    ? 'font-semibold text-indigo-700' 
                    : 'text-gray-800'
                }`}
              >
                <span className="truncate">{group.sgt_title}</span>
                {selectedGroupId === group.sgt_idx && (
                  <span className="ml-2 text-indigo-700">✓</span>
                )}
              </motion.button>
            ))}
          </DropdownPortal>
        )}
      </AnimatePresence>
    </>
  );
});

GroupSelector.displayName = 'GroupSelector';

export default GroupSelector; 