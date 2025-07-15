import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import Image from 'next/image';
import { FaCrown } from 'react-icons/fa';

interface Location {
  lat: number;
  lng: number;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  location: Location;
  mt_gender?: number | null;
  original_index: number;
  mt_weather_sky?: string | number | null;
  mt_weather_tmx?: string | number | null;
  mt_weather_tmn?: string | number | null;
  mt_weather_date?: string | null;
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  sgdt_idx?: number;
}

interface MemberDailyCount {
  mt_idx: number;
  date: string;
  count: number;
}

interface MemberCalendarProps {
  member: GroupMember;
  selectedDate: string;
  currentMonth: Date;
  memberDailyCounts: MemberDailyCount[];
  onCalendarSquareClick: (member: GroupMember, dateString: string, e: React.MouseEvent) => void;
  getSafeImageUrl: (photoUrl: string | null, gender: number | null | undefined, index: number) => string;
}

const MemberCalendar = memo(({ 
  member, 
  selectedDate, 
  currentMonth, 
  memberDailyCounts, 
  onCalendarSquareClick, 
  getSafeImageUrl 
}: MemberCalendarProps) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getDailyCount = (date: Date): number => {
    const dateString = format(date, 'yyyy-MM-dd');
    const dailyCount = memberDailyCounts.find(
      dc => dc.mt_idx === parseInt(member.id) && dc.date === dateString
    );
    return dailyCount?.count || 0;
  };

  const getActivityLevel = (count: number): string => {
    if (count === 0) return 'bg-gray-100';
    if (count <= 10) return 'bg-blue-200';
    if (count <= 50) return 'bg-blue-400';
    if (count <= 100) return 'bg-blue-600';
    return 'bg-blue-800';
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-white/50 shadow-lg">
      {/* 멤버 정보 헤더 */}
      <div className="flex items-center space-x-3 mb-4">
        <div className="relative">
          <Image
            src={getSafeImageUrl(member.photo, member.mt_gender, member.original_index)}
            alt={member.name}
            width={40}
            height={40}
            className={`w-10 h-10 rounded-full object-cover transition-all duration-200 ${
              member.isSelected ? 'ring-2 ring-blue-600' : ''
            }`}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
          />
          {/* 리더/오너 왕관 표시 */}
          {member.sgdt_owner_chk === 'Y' && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
              <FaCrown className="w-2 h-2 text-white" />
            </div>
          )}
          {member.sgdt_owner_chk !== 'Y' && member.sgdt_leader_chk === 'Y' && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
              <FaCrown className="w-2 h-2 text-white" />
            </div>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">{member.name}</h4>
          <p className="text-xs text-gray-500">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </p>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <div 
              key={`${day}-${index}`} 
              className={`text-center text-xs font-bold py-1 rounded-md ${
                index === 0 ? 'text-red-500 bg-red-50' : 
                index === 6 ? 'text-blue-500 bg-blue-50' : 
                'text-gray-600 bg-gray-50'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 gap-1">
        {monthDays.map((date) => {
          const dateString = format(date, 'yyyy-MM-dd');
          const count = getDailyCount(date);
          const isSelected = isSameDay(parseISO(selectedDate), date);
          const isToday = isSameDay(new Date(), date);
          
          return (
            <motion.button
              key={dateString}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => onCalendarSquareClick(member, dateString, e)}
              className={`
                aspect-square text-xs rounded-lg transition-all duration-200 relative
                ${getActivityLevel(count)}
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                ${isToday ? 'border-2 border-red-400' : ''}
                ${count > 0 ? 'hover:shadow-md cursor-pointer' : 'cursor-default opacity-50'}
              `}
              disabled={count === 0}
            >
              <span className={`font-medium ${count > 50 ? 'text-white' : 'text-gray-700'}`}>
                {format(date, 'd')}
              </span>
              {count > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold" style={{ fontSize: '8px' }}>
                    {count > 99 ? '99+' : count}
                  </span>
                </div>
              )}
            </motion.button>
          );
        })}
        </div>
      </div>
    </div>
  );
});

MemberCalendar.displayName = 'MemberCalendar';

export default MemberCalendar; 