# frontend/Dockerfile
# --- 빌드 스테이지 ---
    # Node.js 이미지를 사용하여 빌드
FROM node:lts-alpine as builder 
WORKDIR /app
# package.json 및 lock 파일 복사
COPY package.json package-lock.json ./ 
# 모든 의존성 설치 (devDependencies 포함)
RUN npm install 
# 소스 코드 전체 복사
COPY . . 
# Next.js 프로덕션 빌드 실행 (.next 폴더 생성)
RUN npm run build 

# --- 실행 스테이지 ---
# 빌드 결과 실행을 위한 이미지 (더 작을수록 좋음)
FROM node:llts-alpine 
WORKDIR /app
# 빌드 결과 복사
COPY --from=builder /app/.next ./.next 
# 프로덕션 의존성만 복사하는 방법도 있지만, 빌드 단계에서 설치된 것 복사
COPY --from=builder /app/node_modules ./node_modules 
# package.json은 소스에서 복사
COPY package.json ./package.json 
# public 디렉토리 복사 (정적 파일)
COPY public ./public 

# 만약 .env.production 파일을 사용한다면 복사
# COPY .env.production .env.production

# 프로덕션 의존성만 다시 설치하는 경우 (Optional, 이미지 크기 최적화)
# RUN npm install --only=production

# Next.js 프로덕션 서버 기본 포트
EXPOSE 3000  

# Next.js 프로덕션 서버 실행
# CMD ["npm", "start"] # package.json에 start 스크립트가 next start를 실행해야 함
CMD ["node_modules/.bin/next", "start", "-p", "3001"] # 또는 직접 next start 명령어 사용