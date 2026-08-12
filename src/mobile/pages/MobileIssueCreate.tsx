import { useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AttachmentUpload } from '../../components/AttachmentUpload';
import { CategorySelect } from '../../components/issues/IssueRecordModal';
import { useApp } from '../../context/AppContext';
import { createClientId } from '../../data/clientId';
import { nowText } from '../../data/dateTime';
import { type DeliverySubOrder } from '../../data/deliverySubOrders';
import { ISSUE_CAUSE_LEVEL_1, ISSUE_CAUSE_LEVEL_2, ISSUE_CAUSE_LEVEL_3, nextIssueNo } from '../../data/issuePool';

function MobileFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh w-full bg-[#f5f5f5] sm:mx-auto sm:max-w-[430px] sm:border-x sm:border-gray-200">{children}</main>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-gray-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 ${props.className || ''}`} />;
}

export default function MobileIssueCreate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { state, dispatch } = useApp();
  const subOrderId = params.get('subOrderId') || '';
  const deviceId = params.get('deviceId') || '';
  const fromAcceptance = params.get('fromAcceptance') === '1';
  const subOrder = state.deliverySubOrders.find((item: DeliverySubOrder) => item.id === subOrderId) as DeliverySubOrder | undefined;
  const record = subOrder?.devices.find((item) => item.deviceId === deviceId);
  const plan = state.deliveryPlans.find((item: { id: string }) => item.id === subOrder?.deliveryPlanId);
  const project = state.projects.find((item: { id: string }) => item.id === plan?.projectId);
  const device = state.devices.find((item: { id: string }) => item.id === deviceId);
  const operator = state.currentUser || subOrder?.engineer || subOrder?.owner || '当前用户';
  const [form, setForm] = useState({ symptom: '', causeLevel1: '', causeLevel2: '', causeLevel3: '', materialName: '' });
  const [error, setError] = useState('');

  const returnToDevice = (query = '') => navigate(`/mobile/delivery/${subOrderId}/device/${deviceId}${query}`);
  if (!subOrder || !record || !device) return <MobileFrame><div className="p-5"><button type="button" className="text-sm text-gray-500" onClick={() => navigate('/mobile/tasks?tab=delivery')}>返回我的任务</button><div className="mt-10 rounded-lg border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">当前设备上下文不存在，无法提交问题。</div></div></MobileFrame>;

  const submit = () => {
    if (!form.symptom.trim()) return setError('请填写故障现象描述。');
    if (!['执行中', '待设备验收'].includes(subOrder.status)) return setError('当前尚未进入现场执行，确认到场后才能提交设备问题。');
    const time = nowText();
    const issueId = createClientId('ISSUE');
    const issueNo = nextIssueNo(state.issueRecords);
    const issue = {
      id: issueId,
      issueNo,
      customerName: project?.client || '',
      causeLevel1: form.causeLevel1,
      causeLevel2: form.causeLevel2,
      causeLevel3: form.causeLevel3,
      symptom: form.symptom.trim(),
      siteTroubleshooting: '',
      temporarySolution: '',
      attachments: form.materialName.trim() ? [{ id: createClientId('ISSUEMAT'), name: form.materialName.trim(), purpose: '问题资料', uploadedBy: operator, uploadedAt: time }] : [],
      reporter: operator,
      deviceIdentifier: device.sn || device.robotNo || '',
      reportedAt: time,
      projectName: project?.name || '',
      softwareVersion: device.softwareVersion || '',
      resolutionStatus: '',
      assignee: '',
      rootCause: '',
      longTermSolution: '',
      isClosed: '',
      deviceId,
      projectId: plan?.projectId,
      deliveryContext: { deliveryPlanId: subOrder.deliveryPlanId, projectId: plan?.projectId, locationId: subOrder.locationId, batchId: subOrder.batchId || record.batchId, subOrderId: subOrder.id, node: subOrder.currentNode, deviceRecordId: record.id },
      activityLogs: [{ id: createClientId('ISSUELOG'), time, operator, action: '提交设备问题至问题池', notes: `关联设备 ${device.sn || deviceId}` }],
    };
    dispatch({ type: 'ADD_ISSUE_RECORD', payload: issue });
    dispatch({ type: 'UPDATE_DELIVERY_SUB_ORDER', payload: { ...subOrder, updatedAt: time, issueLinks: [...(subOrder.issueLinks || []), { id: createClientId('DSOISSUE'), issueId, deviceId, createdAt: time }], logs: [...(subOrder.logs || []), { id: createClientId('DSOLOG'), operator, time, action: '提交设备问题至问题池', notes: `创建问题 ${issueNo}，关联设备 ${device.sn || deviceId}`, deviceId, issueId }] } });
    const query = fromAcceptance ? `?acceptanceIssue=${issueId}&issueSubmitted=${encodeURIComponent(issueNo)}` : `?issueSubmitted=${encodeURIComponent(issueNo)}`;
    returnToDevice(query);
  };

  const set = (key: keyof typeof form, value: string) => { setForm((current) => ({ ...current, [key]: value })); setError(''); };
  return <MobileFrame>
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3"><button type="button" aria-label="返回当前设备" onClick={() => returnToDevice()} className="grid h-9 w-9 place-items-center rounded-md text-lg text-gray-600 hover:bg-gray-100">‹</button><div className="min-w-0"><p className="text-sm font-semibold text-gray-900">提交设备问题</p><p className="mt-0.5 text-xs text-gray-400">将创建正式问题池记录</p></div></header>
    <div className="space-y-3 p-4 pb-8"><section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-gray-900">当前设备</h2><dl className="mt-3 divide-y divide-gray-100"><div className="grid grid-cols-[96px_1fr] gap-3 py-2.5 text-sm"><dt className="text-xs text-gray-400">设备 SN</dt><dd className="text-gray-700">{device.sn || '—'}</dd></div><div className="grid grid-cols-[96px_1fr] gap-3 py-2.5 text-sm"><dt className="text-xs text-gray-400">机器人编号</dt><dd className="text-gray-700">{device.robotNo || '—'}</dd></div><div className="grid grid-cols-[96px_1fr] gap-3 py-2.5 text-sm"><dt className="text-xs text-gray-400">项目</dt><dd className="text-gray-700">{project?.name || '—'}</dd></div><div className="grid grid-cols-[96px_1fr] gap-3 py-2.5 text-sm"><dt className="text-xs text-gray-400">提报人</dt><dd className="text-gray-700">{operator}</dd></div></dl></section>
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-gray-900">问题描述</h2><Field label="故障现象描述" required><Textarea value={form.symptom} onChange={(event) => set('symptom', event.target.value)} placeholder="描述现场观察到的故障现象" /></Field><AttachmentUpload value={form.materialName} onChange={(value) => set('materialName', value)} label="现场资料" /></section>
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-gray-900">故障分类</h2><p className="text-xs leading-5 text-gray-400">可按现场已知信息选择，暂不确定时可留空。</p><CategorySelect label="一级故障原因分类" value={form.causeLevel1} options={ISSUE_CAUSE_LEVEL_1} onChange={(value: string) => set('causeLevel1', value)} /><CategorySelect label="二级故障原因分类" value={form.causeLevel2} options={ISSUE_CAUSE_LEVEL_2} onChange={(value: string) => set('causeLevel2', value)} /><CategorySelect label="三级故障分类" value={form.causeLevel3} options={ISSUE_CAUSE_LEVEL_3} onChange={(value: string) => set('causeLevel3', value)} /></section>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}<button type="button" onClick={submit} className="min-h-12 w-full rounded-md bg-gray-900 text-sm font-medium text-white">提交问题</button>
    </div>
  </MobileFrame>;
}
