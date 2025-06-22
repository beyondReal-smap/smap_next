import React, { memo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { FiClock, FiMapPin, FiBell } from 'react-icons/fi';

interface ScheduleEvent {
  id: string;
  sst_idx?: number;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  content?: string;
  groupId?: number;
  groupName?: string;
  groupColor?: string;
  memberName?: string;
  memberPhoto?: string;
  memberGender?: number | null;
  memberIdx?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  locationName?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  hasAlarm?: boolean;
  alarmText?: string;
  alarmTime?: string;
  repeatText?: string;
  distance?: number | null;
  distanceText?: string;
  tgtMtIdx?: number | null;
  isAllDay?: boolean;
  repeatJsonV?: string;
  tgtSgdtOwnerChk?: string;
  tgtSgdtLeaderChk?: string;
  tgtSgdtIdx?: number;
  sst_pidx?: number;
  memberNickname?: string;
  memberCurrentLat?: number | null;
  memberCurrentLng?: number | null;
  memberBattery?: number | null;
  memberGpsTime?: string | null;
}

interface EventCardProps {
  event: ScheduleEvent;
  onEventClick: (event: ScheduleEvent) => void;
  getSafeImageUrl: (photoUrl: string | null, gender: number | null | undefined, index: number) => string;
  getDefaultImage: (gender: number | null | undefined, index: number) => string;
}

const EventCard = memo(({ event, onEventClick, getSafeImageUrl, getDefaultImage }: EventCardProps) => {
  const getEventStatus = (event: ScheduleEvent): { text: string; color: string; bgColor: string } => {
    const now = new Date();
    const eventDate = new Date(event.date);
    const [startHour, startMinute] = event.startTime.split(':').map(Number);
    const [endHour, endMinute] = event.endTime.split(':').map(Number);
    
    const eventStart = new Date(eventDate);
    eventStart.setHours(startHour, startMinute, 0, 0);
    
    const eventEnd = new Date(eventDate);
    eventEnd.setHours(endHour, endMinute, 0, 0);
    
    if (event.isAllDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate.getTime() === today.getTime()) {
        return { text: '오늘 하루종일', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      } else if (eventDate < today) {
        return { text: '완료됨', color: 'text-gray-500', bgColor: 'bg-gray-100' };
      } else {
        return { text: '예정됨', color: 'text-green-600', bgColor: 'bg-green-100' };
      }
    }
    
    if (now >= eventStart && now <= eventEnd) {
      return { text: '진행중', color: 'text-green-600', bgColor: 'bg-green-100' };
    } else if (now > eventEnd) {
      return { text: '완료됨', color: 'text-gray-500', bgColor: 'bg-gray-100' };
    } else {
      return { text: '예정됨', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    }
  };

  const getStatusColor = (statusText: string) => {
    switch (statusText) {
      case '진행중':
      case '오늘 하루종일':
        return 'text-green-600 bg-green-100';
      case '완료됨':
        return 'text-gray-500 bg-gray-100';
      case '예정됨':
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const status = getEventStatus(event);

  return (
    <motion.div
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 event-card"
      onClick={() => onEventClick(event)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)' }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex justify-between items-start mb-3">
        {/* 왼쪽: 일정 정보 */}
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="font-semibold text-gray-900 text-base line-clamp-1">
              {event.title}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status.text)}`}>
              {status.text}
            </span>
          </div>

          <div className="space-y-1.5">
            {/* 시간 정보 */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FiClock className="w-4 h-4 text-gray-400" />
              <span>
                {event.isAllDay ? '하루 종일' : `${event.startTime} - ${event.endTime}`}
              </span>
            </div>

            {/* 장소 정보 */}
            {event.locationName && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FiMapPin className="w-4 h-4 text-gray-400" />
                <span className="truncate">{event.locationName}</span>
                {event.distance !== null && event.distanceText && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                    {event.distanceText}
                  </span>
                )}
              </div>
            )}

            {/* 알림 정보 */}
            {event.hasAlarm && event.alarmText && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FiBell className="w-4 h-4 text-gray-400" />
                <span>{event.alarmText}</span>
              </div>
            )}

            {/* 반복 정보 */}
            {event.repeatText && event.repeatText !== '안함' && (
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                  {event.repeatText}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 멤버 정보 */}
        {event.memberName && (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full overflow-hidden">
              <Image
                src={getSafeImageUrl(event.memberPhoto || null, event.memberGender, event.tgtSgdtIdx || 0)}
                alt={event.memberName}
                width={24}
                height={24}
                className="w-full h-full object-cover"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
                onError={(e) => {
                  e.currentTarget.src = getDefaultImage(event.memberGender, event.tgtSgdtIdx || 0);
                }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700">
              {event.memberNickname || event.memberName}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

EventCard.displayName = 'EventCard';

export default EventCard; 