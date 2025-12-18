#!/bin/bash

# Info.plist 수정 스크립트
echo "🔧 [BUILD SCRIPT] Info.plist 권한 설명 강제 설정 시작"

# 빌드된 앱의 Info.plist 경로
INFO_PLIST_PATH="${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app/Info.plist"

if [ -f "$INFO_PLIST_PATH" ]; then
    echo "🔧 [BUILD SCRIPT] Info.plist 발견: $INFO_PLIST_PATH"
    
    # 권한 설명들을 강제로 설정
    /usr/libexec/PlistBuddy -c "Set :NSCameraUsageDescription 'Camera access is needed to take profile photos and register group images.'" "$INFO_PLIST_PATH"
    /usr/libexec/PlistBuddy -c "Set :NSPhotoLibraryUsageDescription 'Photo library access is needed to set profile photos and attach photos to locations.'" "$INFO_PLIST_PATH"
    /usr/libexec/PlistBuddy -c "Set :NSMotionUsageDescription 'Motion data access is needed to optimize battery usage and detect activity states for accurate location tracking.'" "$INFO_PLIST_PATH"
    /usr/libexec/PlistBuddy -c "Set :NSLocationWhenInUseUsageDescription 'Location access is needed to display current location of family and friends on the map while the app is in use.'" "$INFO_PLIST_PATH"
    /usr/libexec/PlistBuddy -c "Set :NSMicrophoneUsageDescription 'Microphone access is needed for voice messages and call features.'" "$INFO_PLIST_PATH"
    /usr/libexec/PlistBuddy -c "Set :NSLocationAlwaysUsageDescription 'Always location access is needed to detect safe movements and send arrival notifications even when the app is closed.'" "$INFO_PLIST_PATH"
    /usr/libexec/PlistBuddy -c "Set :NSLocationAlwaysAndWhenInUseUsageDescription 'Location access is needed both in foreground and background to provide core features like arrival notifications.'" "$INFO_PLIST_PATH"
    
    echo "✅ [BUILD SCRIPT] Info.plist 권한 설명 강제 설정 완료"
    
    # 확인
    echo "🔎 [BUILD SCRIPT] NSCameraUsageDescription: $(/usr/libexec/PlistBuddy -c "Print :NSCameraUsageDescription" "$INFO_PLIST_PATH" 2>/dev/null || echo "NOT FOUND")"
    echo "🔎 [BUILD SCRIPT] NSLocationWhenInUseUsageDescription: $(/usr/libexec/PlistBuddy -c "Print :NSLocationWhenInUseUsageDescription" "$INFO_PLIST_PATH" 2>/dev/null || echo "NOT FOUND")"
else
    echo "❌ [BUILD SCRIPT] Info.plist 파일을 찾을 수 없음: $INFO_PLIST_PATH"
fi
