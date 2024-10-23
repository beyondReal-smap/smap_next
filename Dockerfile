# Node.js LTS 버전을 기반 이미지로 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사 (캐싱 효율을 위해)
COPY package*.json ./

# 의존성 설치
RUN npm install

# 애플리케이션 코드 복사
COPY . .

# 빌드 스크립트 실행
RUN npm run build

# 실행할 명령어 지정
CMD ["npm", "start"]

# 포트 노출 (Next.js는 기본적으로 3000번 포트 사용)
EXPOSE 3000