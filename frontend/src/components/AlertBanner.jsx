import { useEffect } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

const BASE = {
  error: 'alert-error',
  success: 'alert-ok',
  info: 'alert-ok',
};

export default function AlertBanner({
  message,
  type = 'error',
  duration = 7000,
  onClose,
  className = '',
  styled = true,
  icon = false,
  closeable = true,
}) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => {
      if (typeof onClose === 'function') onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isError = type === 'error';
  const isCustomStyled = /\b(bg-|text-(amber|gray|red|emerald|rose))/.test(className);
  const baseClass = styled && !isCustomStyled ? (BASE[type] || BASE.error) : '';

  return (
    <div className={`${baseClass} ${className} relative`} role="alert">
      <div className="flex items-start gap-2">
        {icon && (isError ? <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" /> : <CircleCheck className="w-4 h-4 mt-0.5 shrink-0" />)}
        <span className="flex-1">{message}</span>
      </div>
      {closeable && typeof onClose === 'function' && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="absolute top-2 right-2 opacity-70 hover:opacity-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
