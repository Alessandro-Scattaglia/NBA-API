import type { ReactNode } from "react";
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
  actions
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
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
