'use client'

import React, { useMemo } from 'react'
import { FlagValues } from 'flags/react'

/**
 * FeatureFlagsEmitter
 * - Vercel Web Analytics가 DOM에서 읽을 수 있도록 클라이언트에서 플래그 값을 노출합니다.
 * - 기본 예시 플래그:
 *   - ios-webview: iOS WebView 여부
 *   - vercel-env: Vercel 환경 여부
 *   - summer-sale: 환경변수 기반 샘플 플래그 (NEXT_PUBLIC_FLAG_SUMMER_SALE)
 */
const FeatureFlagsEmitter: React.FC = () => {
  const flags = useMemo(() => {
    const isClient = typeof window !== 'undefined'
    const isIOSWebView = isClient && /iPad|iPhone|iPod/.test(navigator.userAgent) && !!(window as any).webkit?.messageHandlers
    const isVercelEnv = isClient && (location.host.includes('vercel.app') || location.host.includes('nextstep.smap.site'))

    const strToBool = (val?: string) => (val || '').toLowerCase() === 'true' || val === '1'

    return {
      'ios-webview': !!isIOSWebView,
      'vercel-env': !!isVercelEnv,
      'summer-sale': strToBool(process.env.NEXT_PUBLIC_FLAG_SUMMER_SALE),
    } as Record<string, boolean>
  }, [])

  // FlagValues가 DOM에 플래그를 주입하여 Web Analytics가 자동으로 수집
  return <FlagValues values={flags} />
}

export default FeatureFlagsEmitter


