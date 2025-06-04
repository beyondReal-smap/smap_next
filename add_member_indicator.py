#!/usr/bin/env python3

# 그룹 멤버 점 인디케이터 추가 스크립트

import os

# 파일 경로
file_path = 'frontend/src/app/home/page.tsx'

# 추가할 내용
indicator_code = '''
                    {/* 그룹 멤버 점 인디케이터 */}
                    <div className="flex justify-center items-center space-x-2 mt-4 mb-2">
                      <motion.div
                        className="bg-indigo-600 w-6 h-2 rounded-full"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                      <motion.div
                        className="bg-gray-300 w-2 h-2 rounded-full"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      />
                    </div>'''

# 파일 읽기
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 2997줄 다음에 삽입 (0-based index이므로 2997)
insert_index = 2997

# 새로운 내용 삽입
new_lines = lines[:insert_index] + [indicator_code + '\n'] + lines[insert_index:]

# 파일 쓰기
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("그룹 멤버 점 인디케이터가 성공적으로 추가되었습니다.") 