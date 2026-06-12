import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import '../styles/access-gate.css';

type GateState = 'checking' | 'locked' | 'unlocked';

interface Props {
  children: ReactNode;
}

const DIGITS = 5;

export default function AccessGate({ children }: Props) {
  const [state, setState] = useState<GateState>('checking');
  const [digits, setDigits] = useState<string[]>(Array(DIGITS).fill(''));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const checkStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/access/status', { credentials: 'include' });
      if (!resp.ok) throw new Error('status failed');
      const data = (await resp.json()) as { unlocked?: boolean };
      setState(data.unlocked ? 'unlocked' : 'locked');
    } catch {
      setState('locked');
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (state !== 'locked') return;
    inputRefs.current[0]?.focus();
  }, [state]);

  const submitPin = useCallback(async (pin: string) => {
    if (pin.length !== DIGITS || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const resp = await fetch('/api/access/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = (await resp.json()) as { unlocked?: boolean; error?: string };
      if (!resp.ok || !data.unlocked) {
        setError(data.error || 'Incorrect access code. Please try again.');
        setDigits(Array(DIGITS).fill(''));
        setShake(true);
        window.setTimeout(() => setShake(false), 480);
        inputRefs.current[0]?.focus();
        return;
      }
      setState('unlocked');
    } catch {
      setError('Unable to verify access. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  const handleDigitChange = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, '').slice(-1);
    setError('');
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < DIGITS - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    const pin = next.join('');
    if (pin.length === DIGITS && next.every(Boolean)) {
      void submitPin(pin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      void submitPin(digits.join(''));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGITS);
    if (!pasted) return;
    const next = Array(DIGITS).fill('');
    for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i];
    setDigits(next);
    if (pasted.length === DIGITS) {
      void submitPin(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  if (state === 'checking') {
    return (
      <div className="access-gate access-gate--checking" role="status" aria-live="polite">
        <div className="access-gate__card">
          <div className="access-gate__spinner" aria-hidden="true" />
          <p className="access-gate__checking-text">Verifying access&hellip;</p>
        </div>
      </div>
    );
  }

  if (state === 'unlocked') {
    return <>{children}</>;
  }

  return (
    <div className="access-gate" role="dialog" aria-modal="true" aria-labelledby="access-gate-title">
      <div className="access-gate__backdrop" aria-hidden="true" />
      <div className={`access-gate__card${shake ? ' access-gate__card--shake' : ''}`}>
        <div className="access-gate__brand">
          <span className="access-gate__brand-mark" aria-hidden="true">RETT</span>
          <span className="access-gate__brand-sub">Real Estate Transition Trust</span>
        </div>
        <h1 id="access-gate-title" className="access-gate__title">Authorized Access Required</h1>
        <p className="access-gate__lead">
          This application contains confidential client financial planning tools.
          Enter your five-digit access code to continue.
        </p>
        <form
          className="access-gate__form"
          onSubmit={(e) => {
            e.preventDefault();
            void submitPin(digits.join(''));
          }}
        >
          <label className="access-gate__label" htmlFor="access-pin-0">
            Access code
          </label>
          <div className="access-gate__pin-row" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                id={index === 0 ? 'access-pin-0' : undefined}
                className="access-gate__pin-input"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                disabled={submitting}
                aria-label={`Digit ${index + 1} of ${DIGITS}`}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
              />
            ))}
          </div>
          {error ? (
            <p className="access-gate__error" role="alert">{error}</p>
          ) : (
            <p className="access-gate__hint">Your session stays active until you close this browser.</p>
          )}
          <button type="submit" className="access-gate__submit" disabled={submitting || digits.join('').length !== DIGITS}>
            {submitting ? 'Verifying…' : 'Enter Application'}
          </button>
        </form>
        <p className="access-gate__footer">
          BrookHaven Tax &middot; For authorized personnel only
        </p>
      </div>
    </div>
  );
}
