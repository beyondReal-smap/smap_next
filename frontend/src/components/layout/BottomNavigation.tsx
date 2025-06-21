'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, MessageCircle, User, Map } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hapticFeedback } from '@/utils/haptic'

const navigationItems = [
  {
    name: '홈',
    href: '/home',
    icon: Home,
  },
  {
    name: '검색',
    href: '/search',
    icon: Search,
  },
  {
    name: '지도',
    href: '/map',
    icon: Map,
  },
  {
    name: '채팅',
    href: '/chat',
    icon: MessageCircle,
  },
  {
    name: '마이페이지',
    href: '/profile',
    icon: User,
  },
]

export default function BottomNavigation() {
  const pathname = usePathname()

  const handleNavClick = (href: string) => {
    // 탭 변경 시 메뉴 선택 햅틱 피드백
    if (pathname !== href) {
      hapticFeedback.menuSelect()
    }
  }

  return (
    <nav 
      className="navigation-fixed safe-area-padding-bottom border-t border-gray-200"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        willChange: 'transform',
        WebkitPerspective: 1000,
        WebkitBackfaceVisibility: 'hidden',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))'
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-around py-2">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => handleNavClick(item.href)}
              className={cn(
                'flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 text-xs transition-colors',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon
                className={cn(
                  'w-6 h-6 mb-1',
                  isActive ? 'text-blue-600' : 'text-gray-400'
                )}
              />
              <span
                className={cn(
                  'text-xs',
                  isActive ? 'text-blue-600 font-medium' : 'text-gray-500'
                )}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
} 