import type { ReactNode } from "react";
import "./SurfaceCard.css";

export function SurfaceCard({
  title,
  subtitle,
  children
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card">
      {title || subtitle ? (
        <header className="surface-card-header">
          {title ? <h2>{title}</h2> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
