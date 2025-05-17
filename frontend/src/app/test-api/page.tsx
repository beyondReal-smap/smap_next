'use client';

import React, { useState } from 'react';
import apiClient from '@/services/apiClient'; // Ensure apiClient is correctly imported

export default function TestApiPage() {
  const [groupId, setGroupId] = useState<string>('1186'); // Default group ID
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const fetchGroupMembers = async () => {
    if (!groupId) {
      setError('Group ID를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    setMembers([]);
    setRawResponse(null);

    try {
      // Using the actual service or apiClient directly
      // Option 1: If you have a memberService similar to home/page.tsx
      // import memberService from '@/services/memberService';
      // const data = await memberService.getGroupMembers(parseInt(groupId, 10));
      // setMembers(data);
      // setRawResponse(JSON.stringify(data, null, 2));

      // Option 2: Calling apiClient directly
      const response = await apiClient.get(`/group-members/member/${groupId}`);
      setMembers(response.data);
      setRawResponse(JSON.stringify(response.data, null, 2));

    } catch (err: any) {
      console.error('API 요청 오류:', err);
      setError(err.message || 'API 요청 중 오류가 발생했습니다.');
      if (err.response) {
        setRawResponse(JSON.stringify(err.response.data, null, 2));
      } else {
        setRawResponse('응답 데이터 없음');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>API 테스트 페이지</h1>
      <p><code>GET /api/v1/group-members/member/&#123;groupId&#125;</code> 테스트</p>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="groupIdInput" style={{ marginRight: '10px' }}>Group ID:</label>
        <input
          id="groupIdInput"
          type="text"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          placeholder="그룹 ID 입력"
          style={{ padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button
          onClick={fetchGroupMembers}
          disabled={loading}
          style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? '로딩 중...' : '멤버 조회'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '20px', color: 'red', border: '1px solid red', padding: '10px', borderRadius: '4px' }}>
          <p><strong>오류:</strong></p>
          <pre>{error}</pre>
        </div>
      )}

      <h2>응답 결과 (Raw JSON):</h2>
      <pre style={{ backgroundColor: '#f5f5f5', border: '1px solid #eee', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {rawResponse || '요청을 보내주세요.'}
      </pre>

      <h2>파싱된 멤버 목록:</h2>
      {members.length > 0 ? (
        <ul>
          {members.map((member, index) => (
            <li key={member.mt_idx || index} style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px' }}>
              <strong>ID:</strong> {member.mt_idx}, <strong>이름:</strong> {member.mt_name}, <strong>날씨강수확률(pop):</strong> {member.mt_weather_pop === null ? 'N/A' : member.mt_weather_pop}
              <br />
              <small>전체 데이터: {JSON.stringify(member)}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>{!loading && !error && rawResponse ? '멤버 데이터가 없거나, 응답 형식이 예상과 다릅니다.' : (loading ? '' : '조회된 멤버가 없습니다.')}</p>
      )}
    </div>
  );
} 