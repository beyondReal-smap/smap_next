#!/usr/bin/env node

const http = require('http');
const { exec } = require('child_process');

const DEV_SERVER_PORT = 3000;
const DEV_SERVER_HOST = 'localhost';

// 🔥 에뮬레이터 전용 URL들 추가
const EMULATOR_URLS = [
    'http://10.0.2.2:3000',
    'http://10.0.2.2:3001', 
    'http://10.0.2.2:8080'
];

function checkDevServer() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: DEV_SERVER_HOST,
      port: DEV_SERVER_PORT,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`✅ 개발 서버 연결 성공: ${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`);
      console.log(`📊 응답 상태: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', (err) => {
      console.log(`❌ 개발 서버 연결 실패: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏰ 개발 서버 연결 타임아웃`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// 🔥 에뮬레이터 URL들 테스트
function checkEmulatorUrls() {
  console.log('\n📱 안드로이드 에뮬레이터 URL 테스트:');
  
  EMULATOR_URLS.forEach((url, index) => {
    console.log(`   ${index + 1}. ${url}`);
  });
  
  console.log('\n💡 에뮬레이터에서 연결할 때:');
  console.log('   - 10.0.2.2는 에뮬레이터에서 호스트 머신의 localhost를 의미합니다');
  console.log('   - 실제 디바이스에서는 localhost를 직접 사용할 수 있습니다');
  console.log('   - 개발 서버가 실행 중이어야 합니다: npm run dev');
}

function getNetworkInfo() {
  return new Promise((resolve) => {
    exec('ifconfig | grep "inet " | grep -v 127.0.0.1', (error, stdout) => {
      if (error) {
        console.log('네트워크 정보 조회 실패');
        resolve([]);
        return;
      }
      
      const ips = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/inet (\d+\.\d+\.\d+\.\d+)/);
          return match ? match[1] : null;
        })
        .filter(ip => ip);
      
      resolve(ips);
    });
  });
}

async function main() {
  console.log('🔍 안드로이드 에뮬레이터 개발 서버 연결 상태 확인...\n');
  
  // 네트워크 정보 출력
  const ips = await getNetworkInfo();
  console.log('📱 사용 가능한 IP 주소:');
  ips.forEach(ip => {
    console.log(`   - http://${ip}:${DEV_SERVER_PORT}`);
  });
  
  // 🔥 에뮬레이터 URL 정보 출력
  checkEmulatorUrls();
  
  // 개발 서버 연결 확인
  const isServerRunning = await checkDevServer();
  
  if (!isServerRunning) {
    console.log('\n💡 해결 방법:');
    console.log('1. 개발 서버가 실행 중인지 확인: npm run dev');
    console.log('2. 방화벽 설정 확인');
    console.log('3. 안드로이드 에뮬레이터에서 10.0.2.2:3000 사용');
    console.log('4. 실제 디바이스에서는 localhost:3000 사용');
    console.log('5. AndroidManifest.xml의 usesCleartextTraffic="true" 확인');
    process.exit(1);
  }
  
  console.log('\n🎉 개발 서버가 정상적으로 실행 중입니다!');
  console.log('\n📋 안드로이드 에뮬레이터 디버깅 팁:');
  console.log('1. Chrome > chrome://inspect/#devices에서 WebView 디버깅');
  console.log('2. adb logcat으로 네이티브 로그 확인');
  console.log('3. 에뮬레이터에서는 10.0.2.2:3000으로 접근');
  console.log('4. 실제 디바이스에서는 localhost:3000으로 접근');
}

main().catch(console.error); 