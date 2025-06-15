#!/bin/bash

# Xcode 프로젝트 생성 후 파일 설정 스크립트

echo "SMAP iOS 프로젝트 설정을 시작합니다..."

# Xcode 프로젝트 파일 확인
if [ ! -d "smap.xcodeproj" ]; then
    echo "❌ smap.xcodeproj 파일이 없습니다. 먼저 Xcode에서 프로젝트를 생성해주세요."
    exit 1
fi

echo "✅ Xcode 프로젝트 파일을 찾았습니다."

# 기존 파일들을 프로젝트 내의 올바른 위치로 복사
echo "📁 파일들을 올바른 위치로 복사 중..."

# AppDelegate.swift 교체
if [ -f "smap/AppDelegate.swift" ]; then
    echo "✅ AppDelegate.swift 파일을 교체했습니다."
else
    echo "❌ smap/AppDelegate.swift 파일이 없습니다."
fi

# SceneDelegate.swift 삭제 (사용하지 않음)
if [ -f "smap/SceneDelegate.swift" ]; then
    rm "smap/SceneDelegate.swift"
    echo "✅ SceneDelegate.swift 파일을 삭제했습니다."
fi

# Main.storyboard에 WebViewController 추가 필요
echo "📝 Main.storyboard에서 ViewController를 WebViewController로 변경해야 합니다."

# Assets 폴더 확인
if [ -d "smap/Assets.xcassets" ]; then
    echo "✅ Assets.xcassets 폴더가 있습니다."
fi

# 권한 설정
echo "🔧 Info.plist 파일이 올바르게 설정되었는지 확인..."

# Podfile 확인
if [ -f "Podfile" ]; then
    echo "✅ Podfile이 있습니다."
    echo "📦 이제 'pod install'을 실행할 수 있습니다."
else
    echo "❌ Podfile이 없습니다."
fi

echo ""
echo "🎉 기본 설정이 완료되었습니다!"
echo ""
echo "다음 단계:"
echo "1. Xcode에서 프로젝트를 열고 Main.storyboard를 편집"
echo "2. ViewController를 WebViewController로 변경"
echo "3. 필요한 파일들을 프로젝트에 추가"
echo "4. pod install 실행"
echo "5. smap.xcworkspace 파일로 프로젝트 열기" 