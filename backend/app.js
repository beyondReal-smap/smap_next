const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// 환경 변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000','https://nextstep.smap.site'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 미들웨어
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// 라우트 설정
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/member');

app.use('/api/auth', authRoutes);
app.use('/api/member', memberRoutes);

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'SMAP Backend Server is running'
  });
});

// 404 처리
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API 엔드포인트를 찾을 수 없습니다.',
    path: req.originalUrl
  });
});

// 전역 에러 처리
app.use((error, req, res, next) => {
  console.error('전역 에러:', error);
  res.status(500).json({
    success: false,
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 SMAP Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`👤 Member API: http://localhost:${PORT}/api/member`);
});

module.exports = app; 