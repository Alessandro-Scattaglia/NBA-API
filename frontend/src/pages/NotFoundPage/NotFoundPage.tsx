import { Link } from "react-router-dom";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { PageHeader } from "../../components/common/States";
import "./NotFoundPage.css";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Pagina non trovata" description="La pagina richiesta non esiste oppure non e` ancora disponibile." />
      <SurfaceCard>
        <p>Torna alla Home principale per continuare la navigazione.</p>
        <Link to="/" className="filter-chip">
          Vai alla Home
        </Link>
      </SurfaceCard>
    </>
  );
}
