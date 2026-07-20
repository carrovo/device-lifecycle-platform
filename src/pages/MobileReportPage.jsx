import { useState } from 'react';

const MOCK_DEVICE = {
  deviceNo: '00001',
  sn: 'SN-DEV-010',
  name: 'AlphaBot 2',
  location: '深圳海岸城店',
  project: '智魔方项目',
};

export default function MobileReportPage() {
  const [submitted, setSubmitted] = useState(false);
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-[390px] mx-auto px-6 text-center space-y-6">
          <div className="text-5xl text-green-500">✓</div>
          <div className="text-lg font-semibold text-gray-800">问题已提交，我们会尽快处理</div>
          <p className="text-sm text-gray-500">您的问题报告已成功提交，相关负责人将尽快跟进处理。</p>
          <button onClick={() => { setSubmitted(false); setDesc(''); setFiles([]); }}
            className="w-full py-3 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[390px] mx-auto">
        {/* Header */}
        <div className="bg-white px-6 pt-12 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">HLP</span>
            </div>
            <span className="text-base font-semibold text-gray-800">问题上报</span>
          </div>
          <p className="text-xs text-gray-400">当前上报人：赵六（通过飞书身份识别）</p>
        </div>

        <div className="px-4 py-5 space-y-4">
          {/* Device Info Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">设备信息</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">已自动识别</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="text-gray-400 w-24 flex-shrink-0">Device ID：</span>
                <span className="font-mono text-gray-700">{MOCK_DEVICE.deviceNo}</span>
              </div>
              <div className="flex">
                <span className="text-gray-400 w-24 flex-shrink-0">设备SN：</span>
                <span className="font-mono text-gray-700">{MOCK_DEVICE.sn}</span>
              </div>
              <div className="flex">
                <span className="text-gray-400 w-24 flex-shrink-0">设备名称：</span>
                <span className="text-gray-700">{MOCK_DEVICE.name}</span>
              </div>
              <div className="flex">
                <span className="text-gray-400 w-24 flex-shrink-0">所属点位：</span>
                <span className="text-gray-700">{MOCK_DEVICE.location}</span>
              </div>
              <div className="flex">
                <span className="text-gray-400 w-24 flex-shrink-0">所属项目：</span>
                <span className="text-gray-700">{MOCK_DEVICE.project}</span>
              </div>
            </div>
          </div>

          {/* Report Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <div className="text-sm font-medium text-gray-700">填写问题信息</div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">问题描述 *</label>
              <textarea
                rows={5}
                required
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="请描述发现的问题..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">问题图片（选填）</label>
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-slate-400 transition-colors">
                <span className="text-2xl text-gray-300">📷</span>
                <div>
                  <div className="text-sm text-gray-500">点击选择图片</div>
                  <div className="text-xs text-gray-400">支持多选，JPG / PNG / HEIC</div>
                </div>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => setFiles([...e.target.files])} />
              </label>
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from(files).map((f, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">{f.name}</span>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              提交上报
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
