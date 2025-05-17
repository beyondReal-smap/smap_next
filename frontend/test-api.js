// API 테스트 스크립트
const axios = require('axios');

// API 기본 URL 설정
const API_BASE_URL = 'http://localhost:3000/api';

// axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

async function testMembersApi() {
  console.log('===== 멤버 API 테스트 시작 =====');
  
  try {
    // 모든 멤버 조회
    console.log('\n1. 모든 멤버 조회:');
    const allMembersResponse = await apiClient.get('/members');
    console.log('상태 코드:', allMembersResponse.status);
    console.log('데이터 갯수:', allMembersResponse.data.length);
    console.log('첫 번째 멤버:', allMembersResponse.data[0]);
    
    // ID로 멤버 조회 (쿼리 파라미터)
    console.log('\n2. 쿼리 파라미터로 멤버 조회 (id=1186):');
    const queryParamResponse = await apiClient.get('/members', {
      params: { id: 1186 }
    });
    console.log('상태 코드:', queryParamResponse.status);
    console.log('데이터:', queryParamResponse.data);
    
    // ID로 멤버 조회 (경로 파라미터)
    console.log('\n3. 경로 파라미터로 멤버 조회 (/api/members/1186):');
    const pathParamResponse = await apiClient.get('/members/1186');
    console.log('상태 코드:', pathParamResponse.status);
    console.log('데이터:', pathParamResponse.data);
    
    // 존재하지 않는 멤버 ID 조회
    console.log('\n4. 존재하지 않는 멤버 ID 조회:');
    try {
      const notFoundResponse = await apiClient.get('/members/9999');
      console.log('상태 코드:', notFoundResponse.status);
      console.log('데이터:', notFoundResponse.data);
    } catch (error) {
      console.log('상태 코드:', error.response?.status || 'Unknown');
      console.log('오류 메시지:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('API 테스트 중 오류 발생:', error);
    console.error('응답 상태:', error.response?.status);
    console.error('응답 데이터:', error.response?.data);
  }
  
  console.log('\n===== 멤버 API 테스트 완료 =====');
}

// 테스트 실행
testMembersApi(); 