import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FEISHU_BLUE = '#3370FF';

function AdminLoginModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.username === 'admin' && form.password === 'admin123') {
      localStorage.setItem('isLoggedIn', 'true');
      navigate('/home');
    } else {
      setError('用户名或密码错误');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">平台账号登录（管理员专用）</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => { setForm({ ...form, username: e.target.value }); setError(''); }}
              placeholder="admin"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">密码</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(''); }}
              placeholder="admin123"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
            <button type="submit" className="px-3 py-1.5 text-xs text-white rounded" style={{ backgroundColor: FEISHU_BLUE }}>
              登录
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('qr'); // 'qr' | 'password'
  const [form, setForm] = useState({ phone: '', password: '' });
  const [showAdminModal, setShowAdminModal] = useState(false);

  const handleFeishuLogin = (e) => {
    e.preventDefault();
    localStorage.setItem('isLoggedIn', 'true');
    navigate('/home');
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">
        {/* Header */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: FEISHU_BLUE }}>
          <span className="text-white text-xl font-bold">飞</span>
        </div>
        <h1 className="text-lg font-bold text-gray-800 mb-1">硬件全生命周期管理平台</h1>
        <p className="text-sm text-gray-500 mb-6">智平方机器人</p>

        {/* QR mode */}
        {mode === 'qr' && (
          <div className="flex flex-col items-center gap-4">
            {/* QR placeholder */}
            <div className="w-[200px] h-[200px] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 gap-2">
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-sm ${i % 3 === 0 || i === 4 ? 'bg-gray-700' : 'bg-gray-300'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">扫码区域</p>
            </div>
            <p className="text-sm text-gray-600">使用飞书扫码登录</p>
            <button
              onClick={() => setMode('password')}
              className="text-sm hover:underline"
              style={{ color: FEISHU_BLUE }}
            >
              使用飞书账号密码登录
            </button>
          </div>
        )}

        {/* Password mode */}
        {mode === 'password' && (
          <form onSubmit={handleFeishuLogin} className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">手机号</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="请输入手机号"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">密码</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="请输入密码"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-white rounded-lg font-medium text-sm mt-1"
              style={{ backgroundColor: FEISHU_BLUE }}
            >
              飞书账号登录
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('qr')}
                className="text-sm hover:underline"
                style={{ color: FEISHU_BLUE }}
              >
                返回扫码登录
              </button>
            </div>
          </form>
        )}

        {/* Admin link */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowAdminModal(true)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            使用平台账号登录（管理员专用）
          </button>
        </div>
      </div>

      <AdminLoginModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
    </div>
  );
}
