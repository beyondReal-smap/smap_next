# SMAP - 스케줄과 지도를 한번에

SMAP은 일정 관리와 위치 저장을 한번에 할 수 있는 모바일 최적화 웹 애플리케이션입니다.

## 주요 기능

- **일정 관리**: FullCalendar를 사용한 종합적인 일정 관리 시스템
- **위치 저장**: Mapbox를 활용한 위치 저장 및 관리
- **사용자 설정**: 다양한 환경 설정과 알림 관리
- **인증 시스템**: NextAuth.js를 활용한 강력한 인증 시스템

## 기술 스택

### 프론트엔드
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- React Hook Form + Zod
- FullCalendar
- Mapbox GL JS
- Framer Motion
- Date-fns / Dayjs

### 백엔드
- Express.js
- MongoDB
- JWT 인증
- RESTful API

## 시작하기

### 필수 조건
- Node.js 18.0.0 이상
- npm 또는 yarn
- MongoDB (선택사항: 개발용 목업 데이터 사용 가능)

### 설치

1. 저장소 클론
```bash
git clone https://github.com/yourusername/smap.git
cd smap
```

2. 종속성 설치
```bash
# 프론트엔드 종속성 설치
cd frontend
npm install

# 백엔드 종속성 설치
cd ../backend
npm install
```

3. 환경 변수 설정
```bash
# 프론트엔드 환경 변수
cd frontend
cp .env.example .env.local

# 백엔드 환경 변수
cd ../backend
cp .env.example .env
```

4. 개발 서버 실행
```bash
# 프론트엔드 실행
cd frontend
npm run dev

# 백엔드 실행
cd ../backend
npm run dev
```

## 배포

Docker를 사용하여 배포할 수 있습니다.

```bash
# 프로덕션 빌드
docker-compose -f docker-compose.prod.yml up -d
```

## 주요 페이지

- **로그인 / 회원가입**: 이메일/비밀번호 및 소셜 로그인
- **일정 관리**: 캘린더 기반 일정 관리
- **위치 관리**: 위치 저장 및 관리
- **설정**: 사용자 환경 설정
- **공지사항**: 서비스 공지 확인

## 라이센스

MIT License

## 주요 기능 스크린샷

(추가 예정)

## 기여하기

1. 이 저장소를 포크합니다
2. 기능 브랜치를 만듭니다 (`git checkout -b feature/amazing-feature`)
3. 변경 사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 보냅니다

## 연락처

프로젝트 관리자 - [email@example.com](mailto:email@example.com)

프로젝트 링크: [https://github.com/yourusername/smap](https://github.com/yourusername/smap)

# SMap Local DB Test

Local Express.js application to test the database schema based on `db_info.csv` using Sequelize and MySQL.

## Setup

1.  **Install Node.js:** If you haven't already, install Node.js (which includes npm) from [https://nodejs.org/](https://nodejs.org/).
2.  **Install MySQL:** Install MySQL server locally. You can download it from [https://dev.mysql.com/downloads/mysql/](https://dev.mysql.com/downloads/mysql/) or use a package manager like Homebrew (`brew install mysql`).
3.  **Start MySQL Server:** Ensure your local MySQL server is running.
4.  **Create Database:** Connect to your local MySQL server and create the database specified in `config/config.json` (default: `smap2_local_db`):
    ```sql
    CREATE DATABASE smap2_local_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ```
5.  **Configure Database Connection:** Edit `config/config.json` and update the `development` section with your local MySQL username and password if they differ from the defaults (`root`/`""`).
6.  **Install Dependencies:** Navigate to the project directory in your terminal and run:
    ```bash
    npm install
    ```

## Running the Server

To start the Express server, run:

```bash
npm start
```

Or directly:

```bash
node server.js
```

The server will start on `http://localhost:3000`.

## Testing Database Connection

Open your web browser or use a tool like `curl` to access `http://localhost:3000/test-db`.

-   If successful, you should see "Database connection successful!".
-   If it fails, check the server console output for errors and verify your MySQL server status and connection details in `config/config.json`.

## Database Schema and Models

-   The target database schema is documented in `db_info.csv`.
-   This project uses Sequelize ORM.
-   An example model (`models/member.js`) based on `member_t` is provided.
-   You can create database tables based on your models using Sequelize migrations or the `sync()` method (see commented-out code in `server.js`). 
    -   **Caution:** `sync({ force: true })` will drop existing tables!
    -   `sync({ alter: true })` will attempt to modify tables to match models.
-   To automatically generate tables from the defined models (like `member_t`), you can uncomment the `db.sequelize.sync()` line in `server.js` (use `alter: true` or `force: true` carefully) or use `sequelize-cli` migrations.

## Adding More Models

To add more models based on `db_info.csv`:

1.  Create a new file in the `models/` directory (e.g., `models/coupon.js` for `coupon_t`).
2.  Define the Sequelize model in that file, similar to `models/member.js`, mapping the columns and data types from the CSV.
3.  Sequelize will automatically pick up the new model file.
4.  You might need to run `db.sequelize.sync({ alter: true })` again (or use migrations) to create/update the corresponding table in the database. # Build fix Fri Oct 24 10:09:52 KST 2025
