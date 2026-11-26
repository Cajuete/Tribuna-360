import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

export default function ProductImage({ src, alt }) {
  const [isOpen, setIsOpen] = useState(false);
  const imageButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = event => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    closeButtonRef.current?.focus();
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      imageButtonRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={imageButtonRef}
        type="button"
        disabled={!src}
        onClick={() => setIsOpen(true)}
        aria-label={`Ampliar imagen de ${alt}`}
        className="group relative block w-full aspect-[16/10] cursor-zoom-in overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 disabled:cursor-default"
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-slate-500">
            Imagen no disponible
          </span>
        )}
        {src && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur transition group-hover:bg-emerald-700">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            Ampliar
          </span>
        )}
      </button>

      {isOpen && src && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Imagen ampliada: ${alt}`}
            className="relative max-h-[90vh] w-full max-w-5xl"
            onClick={event => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar imagen ampliada"
              className="absolute -right-2 -top-2 z-10 rounded-full border border-white/20 bg-slate-900 p-2 text-white shadow-lg transition hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={src}
              alt={alt}
              className="mx-auto max-h-[90vh] w-full rounded-xl bg-slate-950 object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
