const express = require('express');
const cors = require('cors');
// const pool = require('./src/config/db'); // 실제 DB 연결시 필요
const locationRoutes = require('./src/routes/locationRoutes');

const app = express();
const PORT = process.env.PORT || 8000; // 백엔드 서버 포트 (프론트와 다름)

// CORS 미들웨어 설정 (개발 중에는 모든 출처 허용, 프로덕션에서는 특정 출처만 허용하도록 변경 필요)
app.use(cors());

// JSON 요청 본문 파싱
app.use(express.json());

// 기본 라우트 (API 상태 확인용)
app.get('/', (req, res) => {
  res.send('SMAP Next Backend is running!');
});

// Location 관련 라우트 등록
// 모든 /api/v1/locations 경로는 locationRoutes에서 처리하도록 수정
app.use('/api/v1/locations', locationRoutes);

// 서버 시작
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  // 실제 DB 연결시 확인 로그
  // pool.query('SELECT 1').then(() => console.log('MySQL DB connected successfully.')).catch(err => console.error('DB Connection Error:', err));
});

// 예기치 않은 오류 처리 (선택 사항)
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // process.exit(1); // 필요한 경우 프로세스 종료
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // process.exit(1);
}); 