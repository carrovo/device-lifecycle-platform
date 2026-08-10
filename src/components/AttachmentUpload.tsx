import { useRef, type DragEvent } from 'react';

type AttachmentUploadProps = {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
};

export type AttachmentListItem = {
  id?: string;
  name: string;
  purpose?: string;
  note?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  addedBy?: string;
  addedAt?: string;
};

function attachmentType(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return '图片';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')) return '视频';
  if (['log', 'txt', 'json', 'csv'].includes(extension || '')) return '日志';
  return '文件';
}

function AttachmentRow({ item, onRemove }: { item: AttachmentListItem; onRemove?: () => void }) {
  const operator = item.uploadedBy || item.addedBy;
  const time = item.uploadedAt || item.addedAt;
  return <div className="flex min-w-0 items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{attachmentType(item.name)}</span>
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-gray-700">{item.name}</p>{(item.purpose || operator || time) && <p className="mt-0.5 truncate text-[11px] text-gray-400">{[item.purpose, operator, time].filter(Boolean).join(' / ')}</p>}{item.note && <p className="mt-0.5 text-[11px] text-gray-500">{item.note}</p>}</div>
    {onRemove && <button type="button" onClick={onRemove} className="shrink-0 text-xs text-gray-400 hover:text-red-600">移除</button>}
  </div>;
}

export function AttachmentUpload({ value, onChange, label = '附件', required = false, disabled = false }: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const select = (file?: File) => { if (file) onChange(file.name); };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) select(event.dataTransfer.files[0]);
  };

  return <div className="space-y-2">
    <div className="flex items-center gap-1"><span className="text-xs text-gray-600">{label}</span>{required && <span className="text-red-500">*</span>}</div>
    <input ref={inputRef} className="hidden" type="file" disabled={disabled} onChange={(event) => { select(event.target.files?.[0]); event.target.value = ''; }} />
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); inputRef.current?.click(); } }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
      className={`flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 text-center transition-colors ${disabled ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400 hover:bg-gray-100'}`}
    >
      <span className="text-lg leading-none">↑</span>
      <span className="mt-2 text-xs font-medium">点击或拖拽文件上传</span>
      <span className="mt-1 text-[11px] text-gray-400">支持图片、视频、日志及附件</span>
    </div>
    {value && <AttachmentRow item={{ name: value }} onRemove={disabled ? undefined : () => onChange('')} />}
  </div>;
}

export function AttachmentList({ items, empty = '暂无资料。' }: { items: AttachmentListItem[]; empty?: string }) {
  if (!items.length) return <p className="text-[13px] text-gray-400">{empty}</p>;
  return <div className="space-y-2">{items.map((item, index) => <AttachmentRow key={item.id || `${item.name}-${index}`} item={item} />)}</div>;
}
