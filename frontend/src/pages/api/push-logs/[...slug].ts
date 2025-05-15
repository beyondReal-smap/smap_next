import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || 'http://backend:5000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug.join('/') : slug;
  const targetUrl = `${BACKEND_URL}/api/v1/push-logs/${path}`;

  console.log(`[PROXY /api/push-logs] Request to: ${req.method} ${targetUrl}`);
  console.log(`[PROXY /api/push-logs] Query: ${JSON.stringify(req.query)}`);
  console.log(`[PROXY /api/push-logs] Body: ${JSON.stringify(req.body)}`);

  try {
    const response = await axios({
      method: req.method as string,
      url: targetUrl,
      headers: {
        ...req.headers,
        // 백엔드와 프론트엔드 서버가 다른 도메인/포트를 사용할 경우 호스트 헤더를 삭제하거나 변경해야 할 수 있습니다.
        host: new URL(targetUrl).host, 
        'content-type': req.headers['content-type'] || 'application/json',
      },
      data: req.body,
      params: req.query, // 쿼리 파라미터를 백엔드로 전달
    });

    console.log(`[PROXY /api/push-logs] Response from backend: ${response.status}`);
    res.status(response.status).send(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`[PROXY /api/push-logs] Error from backend: ${error.response.status}`, error.response.data);
      res.status(error.response.status).send(error.response.data);
    } else {
      console.error('[PROXY /api/push-logs] Unknown error:', error);
      res.status(500).json({ message: 'Internal Server Error in Proxy' });
    }
  }
}

// bodyParser 비활성화 (Next.js 9부터는 기본적으로 비활성화된 요청에 대해 true)
// 만약 특정 요청에 대해 바디 파싱이 필요 없다면 아래와 같이 설정할 수 있습니다.
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// }; 