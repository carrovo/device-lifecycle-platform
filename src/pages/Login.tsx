import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getFeishuAuthorizeUrl } from '../api/auth';
import { useRole } from '../context/RoleContext';

export default function Login() {
  const { isAuthenticated, defaultPath, loginWithPassword } = useRole();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  if (isAuthenticated) return <Navigate to={defaultPath} replace />;

  const loginWithFeishu = async () => {
    setError('');
    setSubmitting('feishu');
    try {
      const { authorizeUrl } = await getFeishuAuthorizeUrl();
      window.location.assign(authorizeUrl);
    } catch (requestError) {
      setError(requestError.message);
      setSubmitting('');
    }
  };

  const loginWithAccount = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting('password');
    try {
      await loginWithPassword(username, password);
    } catch (requestError) {
      setError(requestError.message);
      setSubmitting('');
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f5f6f8] grid lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
      <section className="hidden lg:flex relative overflow-hidden bg-[#111827] p-14 xl:p-20 text-white flex-col justify-between">
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-gray-900 grid place-items-center font-bold">质</div>
          <div>
            <div className="font-semibold">设备全生命周期</div>
            <div className="text-xs text-gray-400 mt-0.5">质量管理平台</div>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-sm text-blue-300 mb-4">DEVICE LIFECYCLE PLATFORM</p>
          <h1 className="text-4xl font-semibold leading-tight">让设备从生产建档到交付运维，始终清晰可追溯。</h1>
          <p className="mt-5 text-gray-400 leading-7">统一管理生产流转、项目交付、设备台账与角色权限，让每一个关键节点都有迹可循。</p>
        </div>
        <p className="relative text-xs text-gray-500">智平方机器人 · 内部业务系统</p>
      </section>

      <section className="flex items-center justify-center bg-[#f5f6f8] px-8 py-10 xl:px-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-lg bg-gray-900 text-white grid place-items-center font-bold">质</div>
            <span className="font-semibold text-gray-900">设备全生命周期</span>
          </div>
          <p className="text-sm text-gray-500">欢迎回来</p>
          <h2 className="text-3xl font-semibold text-gray-900 mt-2">登录管理平台</h2>
          <p className="text-sm text-gray-500 mt-3 mb-7">使用平台账号或企业飞书登录</p>
          <p className="mb-7 mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">请输入账号和密码后登录。</p>

          <form onSubmit={loginWithAccount} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm text-gray-700">账号</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                placeholder="请输入账号"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm text-gray-700">密码</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                placeholder="请输入密码"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="submit"
              disabled={!!submitting}
              className="h-11 w-full rounded-lg bg-gray-900 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
            >
              {submitting === 'password' ? '正在登录…' : '账号密码登录'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            <span>或</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            disabled={!!submitting}
            onClick={loginWithFeishu}
            className="w-full h-12 rounded-lg bg-[#3370ff] text-white text-sm font-medium hover:bg-[#2860e1] disabled:opacity-60 transition flex items-center justify-center gap-2.5"
          >
            <span className="w-6 h-6 rounded-md bg-white/20 grid place-items-center font-bold">飞</span>
            {submitting === 'feishu' ? '正在前往飞书…' : '使用飞书登录'}
          </button>

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</div>}
        </div>
      </section>
    </div>
  );
}
