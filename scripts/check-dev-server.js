#!/usr/bin/env node

const http = require('http');
const { exec } = require('child_process');

const DEV_SERVER_PORT = 3000;
const DEV_SERVER_HOST = 'localhost';

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
  console.log('🔍 iOS WebView 개발 서버 연결 상태 확인...\n');
  
  // 네트워크 정보 출력
  const ips = await getNetworkInfo();
  console.log('📱 사용 가능한 IP 주소:');
  ips.forEach(ip => {
    console.log(`   - http://${ip}:${DEV_SERVER_PORT}`);
  });
  console.log('');
  
  // 개발 서버 연결 확인
  const isServerRunning = await checkDevServer();
  
  if (!isServerRunning) {
    console.log('\n💡 해결 방법:');
    console.log('1. 개발 서버가 실행 중인지 확인: npm run dev');
    console.log('2. 방화벽 설정 확인');
    console.log('3. iOS 시뮬레이터에서 localhost 대신 실제 IP 사용');
    console.log('4. Xcode에서 Info.plist의 NSAppTransportSecurity 설정 확인');
    process.exit(1);
  }
  
  console.log('\n🎉 개발 서버가 정상적으로 실행 중입니다!');
  console.log('\n📋 iOS WebView 디버깅 팁:');
  console.log('1. Safari > 개발자 > 시뮬레이터 > WebView 선택');
  console.log('2. 콘솔에서 에러 메시지 확인');
  console.log('3. 네트워크 탭에서 요청 실패 확인');
}

main().catch(console.error); 