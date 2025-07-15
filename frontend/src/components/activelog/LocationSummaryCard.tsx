import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FiMapPin, FiClock, FiActivity } from 'react-icons/fi';

interface LocationSummary {
  distance: string;
  time: string;
  steps: string;
}

interface LocationSummaryCardProps {
  summary: LocationSummary;
  isLoading?: boolean;
}

const LocationSummaryCard = memo(({ summary, isLoading = false }: LocationSummaryCardProps) => {
  const summaryItems = [
    {
      icon: FiMapPin,
      label: '이동거리',
      value: summary.distance,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: FiClock,
      label: '이동시간',
      value: summary.time,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: FiActivity,
      label: '걸음수',
      value: summary.steps,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((index) => (
            <div key={index} className="text-center animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg"
    >
      <div className="grid grid-cols-3 gap-4">
        {summaryItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="text-center"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className={`w-12 h-12 ${item.bgColor} rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm`}
            >
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </motion.div>
            <p className="text-sm font-medium text-gray-600 mb-1">{item.label}</p>
            <motion.p
              key={item.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-bold text-gray-900"
            >
              {item.value}
            </motion.p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});

LocationSummaryCard.displayName = 'LocationSummaryCard';

export default LocationSummaryCard; 