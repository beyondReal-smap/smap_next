import React, { memo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { FiUsers } from 'react-icons/fi';

export interface ScheduleGroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  mt_gender?: number | null;
  mt_idx: number;
  mt_name: string;
  mt_nickname?: string;
  mt_file1?: string;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  sgdt_idx?: number;
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;
}

interface MemberSelectorProps {
  scheduleGroupMembers: ScheduleGroupMember[];
  newEventId?: string;
  onMemberSelect: (memberId: string) => void;
  getSafeImageUrl: (photoUrl: string | null, gender: number | null | undefined, index: number) => string;
  getDefaultImage: (gender: number | null | undefined, index: number) => string;
}

const MemberSelector = memo(({ 
  scheduleGroupMembers, 
  newEventId, 
  onMemberSelect, 
  getSafeImageUrl, 
  getDefaultImage 
}: MemberSelectorProps) => {
  return (
    <div className="bg-indigo-50 rounded-xl p-4">
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-white">1</span>
        </div>
        <h4 className="font-semibold text-gray-900">일정 대상 멤버</h4>
      </div>

      {scheduleGroupMembers && scheduleGroupMembers.length > 0 ? (
        <div className="grid grid-cols-4 gap-3">
          {scheduleGroupMembers.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                type="button"
                onClick={() => !newEventId && onMemberSelect(member.id)}
                disabled={!!newEventId}
                className={`flex flex-col items-center focus:outline-none mobile-button ${
                  newEventId ? 'cursor-not-allowed opacity-50' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ${
                  member.isSelected ? 'ring-4 ring-indigo-500 ring-offset-2' : ''
                }`}>
                  <Image 
                    src={getSafeImageUrl(member.photo, member.mt_gender, member.sgdt_idx || member.mt_idx || 0)}
                    alt={member.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const fallbackSrc = getDefaultImage(member.mt_gender, member.sgdt_idx || member.mt_idx || 0);
                      console.log(`[이미지 오류] ${member.name}의 이미지 로딩 실패, 기본 이미지로 대체:`, fallbackSrc);
                      target.src = fallbackSrc;
                      target.onerror = null;
                    }}
                    onLoad={() => {
                      console.log(`[이미지 성공] ${member.name}의 이미지 로딩 완료:`, member.photo);
                    }}
                  />
                </div>
                <span className={`block text-xs font-medium mt-2 transition-colors duration-200 ${
                  member.isSelected ? 'text-indigo-700' : 'text-gray-700'
                }`}>
                  {member.name}
                </span>
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <FiUsers className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm">그룹에 참여한 멤버가 없습니다</p>
        </div>
      )}
    </div>
  );
});

MemberSelector.displayName = 'MemberSelector';

export default MemberSelector; 