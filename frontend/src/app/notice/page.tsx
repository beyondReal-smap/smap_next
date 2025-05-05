'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 모의 공지사항 데이터
const MOCK_NOTICES = [
  {
    id: '1',
    title: '서비스 점검 안내 (2023년 9월 15일)',
    content: `안녕하세요, 스맵 서비스를 이용해 주시는 고객님께 감사드립니다.

서비스 안정화를 위한 정기 점검을 아래와 같이 진행할 예정이오니 이용에 참고 부탁드립니다.

- 점검 일시: 2023년 9월 15일 새벽 2시 ~ 5시 (한국 시간 기준)
- 점검 내용: 서버 안정화 및 성능 개선 작업
- 영향: 점검 시간 동안 서비스 이용 불가

점검 작업은 최대한 빠르게 완료할 예정이며, 예정보다 일찍 완료될 경우 별도 공지 없이 서비스가 정상화될 수 있습니다.

이용에 불편을 드려 죄송합니다. 더 나은 서비스를 제공하기 위해 노력하겠습니다.

감사합니다.`,
    date: '2023-09-10T09:00:00',
    author: '스맵 운영팀',
    isImportant: true,
    viewCount: 1245
  },
  {
    id: '2',
    title: '개인정보 처리방침 개정 안내',
    content: `안녕하세요, 스맵 서비스를 이용해 주시는 고객님께 감사드립니다.

스맵 서비스의 개인정보 처리방침이 아래와 같이 개정될 예정임을 안내드립니다.

- 시행일: 2023년 10월 1일
- 주요 변경사항:
  1. 개인정보 보관 기간 명확화
  2. 제3자 제공 항목 구체화
  3. 사용자 권리 및 행사 방법 추가

자세한 내용은 개정된 개인정보 처리방침을 참고해 주시기 바랍니다.
(설정 > 개인정보 처리방침)

문의사항이 있으신 경우 고객센터(1234-5678)로 연락 주시기 바랍니다.

감사합니다.`,
    date: '2023-08-31T14:30:00',
    author: '스맵 개인정보 관리팀',
    isImportant: true,
    viewCount: 987
  },
  {
    id: '3',
    title: '스맵 서비스 신규 기능 안내',
    content: `안녕하세요, 스맵 서비스를 이용해 주시는 고객님께 감사드립니다.

더 나은 서비스 제공을 위해 아래와 같이 신규 기능이 추가되었음을 안내드립니다.

1. 위치 공유 기능 개선
   - 실시간 위치 공유 기능 추가
   - 공유 시간 설정 기능 추가
   
2. 일정 관리 기능 개선
   - 반복 일정 설정 옵션 다양화
   - 일정별 색상 지정 기능 추가
   
3. 알림 기능 개선
   - 알림 설정 세분화
   - 중요 알림 강조 표시 기능 추가

더 자세한 내용은 앱 내 도움말에서 확인하실 수 있습니다.

앞으로도 더 나은 서비스를 제공하기 위해 노력하겠습니다.

감사합니다.`,
    date: '2023-08-15T11:20:00',
    author: '스맵 개발팀',
    isImportant: false,
    viewCount: 752
  },
  {
    id: '4',
    title: '추석 연휴 고객센터 운영 안내',
    content: `안녕하세요, 스맵 서비스를 이용해 주시는 고객님께 감사드립니다.

추석 연휴 기간 동안 고객센터 운영 시간이 아래와 같이 변경됨을 안내드립니다.

- 정상 운영: 9월 27일(수)까지 09:00~18:00
- 축소 운영: 9월 28일(목) ~ 9월 30일(토) 10:00~15:00
- 휴무: 10월 1일(일)
- 정상 운영 재개: 10월 2일(월)부터

연휴 기간 동안 문의량 증가로 답변이 지연될 수 있는 점 양해 부탁드립니다.

편안한 명절 보내시기 바랍니다.

감사합니다.`,
    date: '2023-09-20T16:45:00',
    author: '스맵 고객센터',
    isImportant: false,
    viewCount: 543
  },
  {
    id: '5',
    title: '앱 업데이트 안내 (v2.5.0)',
    content: `안녕하세요, 스맵 서비스를 이용해 주시는 고객님께 감사드립니다.

더 나은 서비스 제공을 위해 앱 업데이트가 진행되었습니다.

- 버전: v2.5.0
- 업데이트 내용:
  1. UI/UX 개선
  2. 지도 로딩 속도 향상
  3. 알림 시스템 안정화
  4. 일부 버그 수정

원활한 서비스 이용을 위해 최신 버전으로 업데이트를 권장드립니다.

앞으로도 더 나은 서비스를 제공하기 위해 노력하겠습니다.

감사합니다.`,
    date: '2023-07-20T10:15:00',
    author: '스맵 개발팀',
    isImportant: false,
    viewCount: 1105
  }
];

// 검색 파라미터를 사용하는 컴포넌트를 분리
function NoticeContent() {
  const [notices, setNotices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const noticeId = searchParams.get('id');
  const pageParam = searchParams.get('page');
  
  // 공지사항 목록 가져오기
  useEffect(() => {
    const fetchNotices = async () => {
      setIsLoading(true);
      
      try {
        // 실제 구현 시에는 API 호출로 데이터를 가져옵니다
        /*
        const response = await fetch(`/api/notices?page=${page}`);
        const data = await response.json();
        
        if (response.ok) {
          setNotices(data.notices);
          setTotalPages(data.totalPages);
        }
        */
        
        // 모의 데이터 로드 (API 연동 전 테스트용)
        await new Promise(resolve => setTimeout(resolve, 500));
        setNotices(MOCK_NOTICES);
        setTotalPages(Math.ceil(MOCK_NOTICES.length / 10));
      } catch (error) {
        console.error('공지사항을 불러오는 중 오류가 발생했습니다.', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchNotices();
  }, [page]);
  
  // URL의 id 파라미터에 따라 선택된 공지사항 설정
  useEffect(() => {
    if (noticeId) {
      const notice = MOCK_NOTICES.find(n => n.id === noticeId);
      setSelectedNotice(notice || null);
    } else {
      setSelectedNotice(null);
    }
    
    if (pageParam) {
      setPage(Number(pageParam));
    }
  }, [noticeId, pageParam]);
  
  // 공지사항 목록으로 돌아가기
  const handleBackToList = () => {
    router.push('/notice');
  };
  
  // 공지사항 항목 클릭 시 상세 페이지로 이동
  const handleNoticeClick = (id: string) => {
    router.push(`/notice?id=${id}`);
  };
  
  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    router.push(`/notice?page=${newPage}`);
  };
  
  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy년 MM월 dd일', { locale: ko });
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-suite">공지사항</h1>
        <p className="mt-2 text-gray-600">스맵 서비스의 최신 소식과 업데이트 내용을 확인하세요</p>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
      
      {/* 공지사항 상세 */}
      {!isLoading && selectedNotice && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
            <div className="flex justify-between items-center">
              <button
                onClick={handleBackToList}
                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                목록으로
              </button>
            </div>
          </div>
          
          <div className="px-4 py-5 sm:px-6">
            <div className="mb-4">
              {selectedNotice.isImportant && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2">
                  중요
                </span>
              )}
              <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedNotice.title}</h2>
            </div>
            
            <div className="flex items-center text-sm text-gray-500 mb-6">
              <div className="mr-6">
                <span className="font-medium text-gray-600">작성자:</span> {selectedNotice.author}
              </div>
              <div className="mr-6">
                <span className="font-medium text-gray-600">등록일:</span> {formatDate(selectedNotice.date)}
              </div>
              <div>
                <span className="font-medium text-gray-600">조회수:</span> {selectedNotice.viewCount.toLocaleString()}
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6 pb-4">
              <div className="prose prose-indigo max-w-none">
                {selectedNotice.content.split('\n').map((line: string, index: number) => (
                  <p key={index} className={index > 0 ? 'mt-4' : ''}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 공지사항 목록 */}
      {!isLoading && !selectedNotice && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    번호
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제목
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    작성자
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    등록일
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    조회수
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {notices.length > 0 ? (
                  notices.map((notice, index) => (
                    <tr 
                      key={notice.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleNoticeClick(notice.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(page - 1) * 10 + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {notice.isImportant && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2">
                              중요
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-900">
                            {notice.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {notice.author}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(notice.date), 'yyyy.MM.dd', { locale: ko })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {notice.viewCount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      등록된 공지사항이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* 페이지네이션 */}
          {notices.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-center border-t border-gray-200 sm:px-6">
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">이전</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePageChange(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === i + 1
                        ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">다음</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NoticePage() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <NoticeContent />
    </Suspense>
  );
} 