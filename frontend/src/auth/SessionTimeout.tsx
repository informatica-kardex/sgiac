import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useUserAuthStore } from "../store/userAuthStore";
import { clearSession, updateSessionInfo, useSessionInfo } from "./session";
import "../styles/session-timeout.css";

export function SessionTimeout() {
  const admin = useAdminAuthStore(s => s.isAuthenticated);
  const student = useUserAuthStore(s => s.isAuthenticated);
  const sessionId = useSessionInfo(s => s.session?.id);
  const expired = useSessionInfo(s => s.expired);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const continueSession = useRef<() => void>(() => {});
  const navigate = useNavigate();

  useEffect(() => { if (expired) navigate("/login", { replace: true }); }, [expired, navigate]);

  useEffect(() => {
    if (!sessionId || (!admin && !student)) { setSeconds(null); return; }
    let active = true;
    let pending = false;
    let dirty = false;
    let lastAttempt = 0;
    const remaining = () => Math.ceil(((useSessionInfo.getState().session?.expiresAt ?? 0) - Date.now()) / 1000);
    const expire = () => {
      if (!active) return;
      active = false;
      void authApi.logout().catch(() => {});
      clearSession(true);
    };
    const renew = async () => {
      if (!active || pending || document.visibilityState !== "visible") return;
      if (remaining() <= 0) { expire(); return; }
      pending = true;
      dirty = false;
      lastAttempt = Date.now();
      setBusy(true);
      try {
        const { data } = await authApi.activity();
        if (active) { updateSessionInfo(data.data); setError(""); setSeconds(null); }
      } catch {
        if (active) setError("No se pudo prolongar la sesión. Revisa tu conexión e inténtalo de nuevo.");
      } finally { pending = false; if (active) setBusy(false); }
    };
    continueSession.current = () => { void renew(); };
    const tick = () => {
      if (!active) return;
      const left = remaining();
      if (left <= 0) { expire(); return; }
      setSeconds(left <= 30 ? left : null);
      if (dirty && Date.now() - lastAttempt >= 10000) void renew();
    };
    const activity = (event: Event) => {
      // Las consultas automáticas, eventos sintéticos y pestañas ocultas no prolongan la sesión.
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      if (remaining() <= 0) { expire(); return; }
      // Durante el aviso se requiere pulsar explícitamente «Continuar».
      if (remaining() <= 30) return;
      dirty = true;
      if (Date.now() - lastAttempt >= 10000) void renew();
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll"];
    const visibility = () => { if (document.visibilityState === "hidden") dirty = false; tick(); };
    events.forEach(name => window.addEventListener(name, activity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", tick);
    const timer = window.setInterval(tick, 1000);
    setBusy(false);
    setError("");
    tick();
    return () => {
      active = false;
      window.clearInterval(timer);
      events.forEach(name => window.removeEventListener(name, activity, true));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", tick);
    };
  }, [sessionId, admin, student]);

  const warning = seconds !== null;
  useEffect(() => {
    if (warning) dialog.current?.showModal();
    else dialog.current?.close();
  }, [warning]);

  const countdown = Math.max(0, Math.min(30, seconds ?? 0));
  const announcement = seconds === null ? "" : `Tu sesión se cerrará en ${Math.ceil(countdown / 10) * 10} segundos.`;

  return <dialog ref={dialog} aria-labelledby="session-warning-title" aria-describedby="session-warning-description"
    onCancel={event => event.preventDefault()} className="session-timeout" data-urgent={warning && countdown <= 10}>
    <div className="session-timeout__content">
      <span className="session-timeout__eyebrow">Un momento, por favor</span>
      <h2 id="session-warning-title" className="session-timeout__title">¿SIGUES AHÍ?</h2>
      <p id="session-warning-description" className="session-timeout__description">Tu sesión se cerrará en…</p>

      <div className="session-timeout__countdown" role="timer" aria-live="off" aria-label={`${countdown} segundos para el cierre de sesión`}>
        <svg viewBox="0 0 144 144" aria-hidden="true" focusable="false">
          <circle className="session-timeout__track" cx="72" cy="72" r="64" />
          <circle className="session-timeout__progress" cx="72" cy="72" r="64" pathLength="100"
            strokeDasharray="100" strokeDashoffset={100 - countdown / 30 * 100} />
        </svg>
        <div className="session-timeout__time" aria-hidden="true"><strong>{String(countdown).padStart(2, "0")}</strong><span>segundos</span></div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      <p className="session-timeout__hint">Llevas un momento sin actividad.<br />Continúa para seguir donde te quedaste.</p>
      {error && <p role="alert" className="session-timeout__error">{error}</p>}

      <div className="session-timeout__actions">
        <button type="button" autoFocus className="session-timeout__continue" disabled={busy} onClick={() => continueSession.current()}>
          <span>{busy ? "Continuando…" : "Continuar sesión"}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
        <button type="button" className="session-timeout__logout" onClick={() => { void authApi.logout().catch(() => {}); clearSession(true); }}>Cerrar sesión</button>
      </div>
    </div>
    <div className="session-timeout__footer">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg>
      <span>Cierre automático para proteger tu cuenta</span>
    </div>
  </dialog>;
}
