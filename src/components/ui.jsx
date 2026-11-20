import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLabel, STATUS, useT } from '../lib/i18n.jsx';
import { icDigits, icMask } from '../lib/format.js';

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

const Eye = ({ off }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
    {off && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);

// Password field with an eye button to show or hide what was typed.
export function PasswordInput({ showLabel = 'Show password', hideLabel = 'Hide password', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="pw-eye" onClick={() => setShow((v) => !v)} aria-label={show ? hideLabel : showLabel} aria-pressed={show} title={show ? hideLabel : showLabel}>
        <Eye off={show} />
      </button>
    </div>
  );
}

export const FingerprintIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 11c0 3.5-.5 6.5-2 9" /><path d="M8.5 7.6A5 5 0 0 1 17 11c0 1.6-.1 3.1-.4 4.5" /><path d="M5.2 15.5A12 12 0 0 0 7 11a5 5 0 0 1 .4-2" />
    <path d="M14.8 20.5c.5-1.3.9-2.7 1.1-4.2" /><path d="M3.5 10a9 9 0 0 1 16.4-3.6" /><path d="M20.6 10.5c.3 2.3.2 4.6-.3 6.8" /><path d="M12 11v.01" />
  </svg>
);

// IC (No. KP) box: takes digits only (up to 12) and shows them as 000000-00-0000.
// Works with useForm's bind(): onChange gets an event-like object whose target.value is the plain digits. The browser blocks saving unless the box is empty or has all 12 digits
// (pass required to make it compulsory).
export function IcInput({ value, onChange, ...props }) {
  const t = useT();
  const ref = useRef();
  const caret = useRef(null);
  const shown = icMask(value);
  useLayoutEffect(() => {
    if (caret.current == null || !ref.current || document.activeElement !== ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  function change(e) {
    const el = e.target;
    const pos = el.selectionStart ?? el.value.length;
    let digits = icDigits(el.value);
    let before = icDigits(el.value.slice(0, pos)).length;
    // Backspace or Delete on a dash removes the digit beside it instead of doing nothing.
    const kind = e.nativeEvent?.inputType || '';
    if (digits === icDigits(value) && kind.startsWith('delete')) {
      if (kind === 'deleteContentBackward' && before > 0) { digits = digits.slice(0, before - 1) + digits.slice(before); before -= 1; }
      else if (kind === 'deleteContentForward') digits = digits.slice(0, before) + digits.slice(before + 1);
    }
    caret.current = icMask(digits.slice(0, before)).length;
    onChange({ target: { value: digits } });
  }
  return (
    <input {...props} ref={ref} value={shown} onChange={change} inputMode="numeric" autoComplete="off" maxLength={14}
      placeholder={props.placeholder || '000000-00-0000'} pattern="\d{6}-\d{2}-\d{4}"
      title={t('No. KP mesti 12 digit, contoh 060501-03-0034', 'IC no. must be 12 digits, e.g. 060501-03-0034')} />
  );
}

export function Search({ value, onChange, placeholder }) {
  return <input className="search" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
