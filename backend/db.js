const mysql = require('mysql2/promise');

// 데이터베이스 연결 설정
const dbConfig = {
  host: 'localhost',
  user: 'smap2',
  password: 'dmonster',
  database: 'smap2_db',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 커넥션 풀 생성
const pool = mysql.createPool(dbConfig);

// 연결 테스트 함수
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('데이터베이스 연결 성공!');
    connection.release();
    return true;
  } catch (error) {
    console.error('데이터베이스 연결 오류:', error);
    return false;
  }
}

module.exports = {
  pool,
  testConnection
}; 