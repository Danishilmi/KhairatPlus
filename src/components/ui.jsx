import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLabel, STATUS, useT } from '../lib/i18n.jsx';

export function Field({ label, hint, children, wide }) {
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, footer, size }) {
  const ref = useRef();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('input,select,textarea')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (size === 'lg' ? ' modal-lg' : '')} role="dialog" aria-modal="true" ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Badge({ status }) {
  const label = useLabel();
  return <span className={'badge badge-' + status}>{label(STATUS, status)}</span>;
}

export function Stat({ label, value, tone, sub }) {
  return (
    <div className={'stat' + (tone ? ' stat-' + tone : '')}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }
export function Spinner() { const t = useT(); return <div className="spinner" role="status">{t('Memuatkan…', 'Loading…')}</div>; }
export function ErrorBox({ children }) { return children ? <div className="alert alert-error">{children}</div> : null; }

// Toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">{items.map((i) => <div key={i.id} className={'toast toast-' + i.tone}>{i.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// Loads data with an async function; reload() to refresh.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((n) => n + 1) };
}

// Simple controlled form state.
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const bind = (name, type) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => setValues((v) => ({ ...v, [name]: type === 'number' ? e.target.value : e.target.value }))
  });
  return { values, setValues, bind };
}

export function Search({ value, onChange, placeholder }) {
  return <input className="search" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
