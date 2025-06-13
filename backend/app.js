const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 8080;

// 미들웨어
app.use(cors());
app.use(express.json());

// 라우터 등록
app.use('/api/auth', authRouter);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ message: 'SMAP Backend Server' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 