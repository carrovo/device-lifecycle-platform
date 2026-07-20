export default function OperationLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm">暂无操作记录</div>
    );
  }

  const sorted = [...logs].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  const actionTypeColors = {
    '装配': 'bg-blue-500',
    '功能测试通过': 'bg-green-500',
    '功能测试不合格': 'bg-red-500',
    '老化测试通过': 'bg-green-500',
    '老化测试不合格': 'bg-red-500',
    '终测通过': 'bg-green-500',
    '终测不合格': 'bg-red-500',
    '返修完成': 'bg-purple-500',
    '状态变更': 'bg-gray-500',
  };

  return (
    <div className="space-y-0">
      {sorted.map((log, idx) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                actionTypeColors[log.actionType] || 'bg-gray-400'
              }`}
            />
            {idx < sorted.length - 1 && (
              <div className="w-0.5 bg-gray-200 flex-1 my-1" />
            )}
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-medium text-sm text-gray-800">{log.actionType}</span>
              <span className="text-xs text-gray-400">{log.timestamp}</span>
              <span className="text-xs text-gray-500">· {log.operator}</span>
            </div>
            {(log.fromStatus || log.toStatus) && (
              <div className="text-xs text-gray-500 mb-0.5">
                {log.fromStatus ? (
                  <span className="text-gray-500">{log.fromStatus}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                <span className="mx-1 text-gray-400">→</span>
                <span className="text-gray-700 font-medium">{log.toStatus}</span>
              </div>
            )}
            {log.notes && (
              <div className="text-xs text-gray-400">{log.notes}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
