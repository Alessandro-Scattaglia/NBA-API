import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTimeWithSeconds } from "../../../lib/format";
import "./States.css";

export function LoadingState({ label = "Caricamento in corso..." }: { label?: string }) {
  return <div className="state-card state-card-loading">{label}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-card state-card-error">{message}</div>;
}

export function EmptyState({ label }: { label: string }) {
  return <div className="state-card state-card-empty">{label}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  showBackButton = true
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  showBackButton?: boolean;
}) {
  const navigate = useNavigate();

  const goBack = () => {
    if (typeof window !== "undefined" && typeof window.history.state?.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/");
  };

  return (
    <div className="page-header">
      <div className="page-header-copy">
        {showBackButton ? (
          <button type="button" className="page-back-button" onClick={goBack} aria-label="Torna alla pagina precedente">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="page-back-icon">
              <path
                d="M14.5 6.5 8.5 12l6 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Indietro</span>
          </button>
        ) : null}
        <p className="eyebrow">NBA 2025-2026</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function DataStamp({ updatedAt, stale }: { updatedAt: string; stale: boolean }) {
  return (
    <div className="data-stamp">
      <span>Ultimo aggiornamento: {formatDateTimeWithSeconds(updatedAt)}</span>
      {stale ? <span className="badge badge-warning">Cache non aggiornata</span> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "live";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
