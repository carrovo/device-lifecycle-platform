import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRole } from '../context/RoleContext';

export default function FeishuCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithFeishuTicket } = useRole();
  const started = useRef(false);
  const ticket = searchParams.get('ticket');
  const [error, setError] = useState(
    searchParams.get('error') || (!ticket ? '飞书登录回调缺少登录票据' : ''),
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!ticket) return;
    loginWithFeishuTicket(ticket)
      .then((user) => navigate(user.allowedPaths?.[0] || '/home', { replace: true }))
      .catch((requestError) => setError(requestError.message));
  }, [loginWithFeishuTicket, navigate, ticket]);

  return (
    <div className="w-full min-h-screen grid place-items-center bg-[#f5f6f8] p-6">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <div className="mx-auto w-10 h-10 rounded-full bg-red-50 text-red-600 grid place-items-center text-lg">!</div>
            <h1 className="mt-4 text-base font-semibold text-gray-900">飞书登录失败</h1>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <button onClick={() => navigate('/login', { replace: true })} className="mt-5 h-9 px-4 rounded-md bg-gray-900 text-white text-sm">返回登录页</button>
          </>
        ) : (
          <>
            <div className="mx-auto w-10 h-10 rounded-full border-2 border-blue-100 border-t-blue-500 animate-spin" />
            <h1 className="mt-4 text-base font-semibold text-gray-900">正在完成飞书登录</h1>
            <p className="mt-2 text-sm text-gray-500">请稍候，不要关闭当前页面。</p>
          </>
        )}
      </div>
    </div>
  );
}
