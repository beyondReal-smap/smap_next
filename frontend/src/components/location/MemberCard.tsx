import React, { memo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { FaCrown } from 'react-icons/fa';

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
  savedLocations: LocationData[];
  savedLocationCount?: number;
  mt_gender?: number | null;
  original_index: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
}

interface MemberCardProps {
  member: GroupMember;
  onMemberSelect: (memberId: string) => void;
  onLocationSelect: (location: LocationData) => void;
  getDefaultImage: (gender: number | null | undefined, index: number) => string;
}

const MemberCard = memo(({ member, onMemberSelect, onLocationSelect, getDefaultImage }: MemberCardProps) => {
  const memberItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={memberItemVariants}
      whileTap={{ scale: 0.98 }}
      onClick={() => onMemberSelect(member.id)}
      className={`p-4 rounded-xl cursor-pointer transition-all duration-300 backdrop-blur-sm ${
        member.isSelected 
          ? 'border-2 shadow-lg' 
          : 'bg-white/60 hover:bg-white/90 border hover:shadow-md'
      }`}
      style={member.isSelected 
        ? { 
            background: 'linear-gradient(to bottom right, rgba(240, 249, 255, 0.8), rgba(253, 244, 255, 0.8))',
            borderColor: 'rgba(1, 19, 163, 0.3)',
            boxShadow: '0 10px 25px rgba(1, 19, 163, 0.1)'
          }
        : { 
            borderColor: 'rgba(1, 19, 163, 0.1)'
          }
      }
    >
      <div className="flex items-center space-x-4">
        <div className="relative">
          <motion.div 
            className={`w-12 h-12 rounded-full overflow-hidden ${
              member.isSelected 
                ? 'ring-3 shadow-lg' 
                : 'ring-2 ring-white/50'
            }`}
            style={member.isSelected 
              ? { 
                  '--tw-ring-color': 'rgba(1, 19, 163, 0.3)',
                  boxShadow: '0 10px 25px rgba(1, 19, 163, 0.2)'
                } as React.CSSProperties
              : {}
            }
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Image 
              src={member.photo || getDefaultImage(member.mt_gender, member.original_index)}
              alt={member.name} 
              width={48}
              height={48}
              className="w-full h-full object-cover"
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                const defaultImg = getDefaultImage(member.mt_gender, member.original_index);
                target.src = defaultImg;
                target.onerror = null;
              }}
            />
          </motion.div>
          
          {/* 리더/오너 왕관 표시 */}
          {member.sgdt_owner_chk === 'Y' && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
              <FaCrown className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          {member.sgdt_owner_chk !== 'Y' && member.sgdt_leader_chk === 'Y' && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
              <FaCrown className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={`font-normal text-sm ${member.isSelected ? 'text-gray-900' : 'text-gray-900'} truncate`}>
              {member.name}
            </h4>
            {/* 총 장소 수 */}
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">📍</span>
              <span className={`text-xs font-normal ${
                member.isSelected ? 'text-gray-700' : 'text-gray-700'
              }`}>
                {member.savedLocationCount ?? member.savedLocations?.length ?? 0}개
              </span>
            </div>
          </div>
          
          {/* 선택된 멤버의 장소 리스트 표시 */}
          {member.isSelected && member.savedLocations && member.savedLocations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-3"
            >
              <div className="max-h-48 overflow-y-auto hide-scrollbar space-y-2 pr-1">
                {member.savedLocations.map((location, locationIndex) => (
                  <motion.div
                    key={location.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: locationIndex * 0.1 }}
                    className="flex items-center space-x-2 p-2 bg-white/40 rounded-lg backdrop-blur-sm border border-white/30 hover:bg-white/60 transition-colors cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLocationSelect(location);
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex-shrink-0"></div>
                    <span className="text-xs text-gray-600 truncate flex-1">
                      {location.name}
                    </span>
                    <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.div>
                ))}
              </div>
              {member.savedLocations.length > 5 && (
                <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-200/50 mt-2">
                  총 {member.savedLocations.length}개의 장소
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

MemberCard.displayName = 'MemberCard';

export default MemberCard; 