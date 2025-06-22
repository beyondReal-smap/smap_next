import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FiMapPin, FiBell, FiBellOff, FiMoreVertical } from 'react-icons/fi';

interface OtherMemberLocationRaw {
  id: string;
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  memo: string;
  favorite: boolean;
  notifications?: boolean;
  memberName?: string;
  memberPhoto?: string;
  memberGender?: number | null;
  memberIdx?: number;
}

interface LocationCardProps {
  location: OtherMemberLocationRaw;
  index: number;
  onLocationClick: (location: OtherMemberLocationRaw) => void;
  onNotificationToggle: (location: OtherMemberLocationRaw) => void;
  onHideLocation: (location: OtherMemberLocationRaw) => void;
  getDefaultImage: (gender: number | null | undefined, index: number) => string;
}

const LocationCard = memo(({ 
  location, 
  index, 
  onLocationClick, 
  onNotificationToggle, 
  onHideLocation, 
  getDefaultImage 
}: LocationCardProps) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { delay: index * 0.1 }
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="location-card bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer"
      onClick={() => onLocationClick(location)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FiMapPin className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {location.name}
            </h3>
            <p className="text-xs text-gray-500 truncate">
              {location.address}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 flex-shrink-0">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onNotificationToggle(location);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              location.notifications 
                ? 'bg-green-100 text-green-600' 
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {location.notifications ? (
              <FiBell className="w-3 h-3" />
            ) : (
              <FiBellOff className="w-3 h-3" />
            )}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onHideLocation(location);
            }}
            className="p-1.5 rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors"
          >
            <FiMoreVertical className="w-3 h-3" />
          </motion.button>
        </div>
      </div>
      
      {location.memo && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
            {location.memo}
          </p>
        </div>
      )}
      
      {location.memberName && (
        <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
          <div className="w-6 h-6 rounded-full overflow-hidden">
            <img
              src={location.memberPhoto || getDefaultImage(location.memberGender, location.memberIdx || 0)}
              alt={location.memberName}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = getDefaultImage(location.memberGender, location.memberIdx || 0);
              }}
            />
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {location.memberName}
          </span>
        </div>
      )}
    </motion.div>
  );
});

LocationCard.displayName = 'LocationCard';

export default LocationCard; 