import { useEffect, type PropsWithChildren } from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ModalProps extends PropsWithChildren {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  mobile?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', mobile = false }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = ({
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  } satisfies Record<ModalSize, string>)[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className={`relative box-border bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] border border-[#ececec] w-full ${mobile ? 'sm:max-w-[calc(430px-2rem)]' : sizeClass} max-h-[calc(100vh-2rem)] flex flex-col`}>
        <div className="flex flex-shrink-0 items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
          <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md w-7 h-7 flex items-center justify-center text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
