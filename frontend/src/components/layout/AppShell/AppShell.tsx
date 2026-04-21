import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import "./AppShell.css";

function SidebarIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-link-icon-svg">
      {children}
    </svg>
  );
}

const NBA_WIKIPEDIA_LOGO = "https://upload.wikimedia.org/wikipedia/en/0/03/National_Basketball_Association_logo.svg";

const navItems = [
  {
    to: "/",
    label: "Home",
    icon: (
      <SidebarIcon>
        <path d="M4 12.5 12 5l8 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 10.5V19h9v-8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </SidebarIcon>
    )
  },
  {
    to: "/teams",
    label: "Squadre",
    icon: (
      <SidebarIcon>
        <path d="M8 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16.5 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 18.5c.6-2.5 2.5-4 5-4s4.4 1.5 5 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M13.8 17.8c.4-1.7 1.7-2.8 3.5-2.8 1.1 0 2 .3 2.7.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SidebarIcon>
    )
  },
  {
    to: "/players",
    label: "Giocatori",
    icon: (
      <SidebarIcon>
        <circle cx="12" cy="7.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6.2 19c1-2.9 3.2-4.6 5.8-4.6s4.8 1.7 5.8 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SidebarIcon>
    )
  },
  {
    to: "/standings",
    label: "Classifica",
    icon: (
      <SidebarIcon>
        <path d="M5 18V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 18V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M19 18V4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SidebarIcon>
    )
  },
  {
    to: "/playoffs",
    label: "Playoff",
    icon: (
      <SidebarIcon>
        <path d="M7.5 18.5h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.4 15.6h7.2l1.4-7.6H7l1.4 7.6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9.5 8V6.4a2.5 2.5 0 0 1 5 0V8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SidebarIcon>
    )
  },
  {
    to: "/calendar",
    label: "Calendario",
    icon: (
      <SidebarIcon>
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.8v3.4M16 3.8v3.4M4.5 10h15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SidebarIcon>
    )
  },
  {
    to: "/leaders",
    label: "Leader",
    icon: (
      <SidebarIcon>
        <path d="M7.5 18.5h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.5 15.5h7l1.3-7.5H7.2l1.3 7.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M7.6 9.3H6A1.8 1.8 0 0 0 6.2 13h1.9M16.4 9.3H18a1.8 1.8 0 0 1-.2 3.7h-1.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SidebarIcon>
    )
  }
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("nba-sidebar-collapsed") === "true";
  });
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    window.localStorage.setItem("nba-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "app-shell-collapsed" : ""}`}>
      {menuOpen ? <button type="button" className="sidebar-backdrop" aria-label="Chiudi menu" onClick={() => setMenuOpen(false)} /> : null}

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-toggle sidebar-toggle-top"
          aria-label={sidebarCollapsed ? "Espandi barra laterale" : "Riduci barra laterale"}
          title={sidebarCollapsed ? "Espandi barra laterale" : "Riduci barra laterale"}
          onClick={() => setSidebarCollapsed((value) => !value)}
        >
          <span className="sidebar-toggle-icon">
            <SidebarIcon>
              <path
                d={sidebarCollapsed ? "M10 7.5 14.5 12 10 16.5" : "M14 7.5 9.5 12 14 16.5"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </SidebarIcon>
          </span>
        </button>

        <div className="sidebar-header">
          <Link to="/" className="brand-mark">
            <span className="brand-logo" aria-hidden="true">
              <img src={NBA_WIKIPEDIA_LOGO} alt="" className="brand-logo-image" />
            </span>
            <strong className="brand-title">NBA 2025-2026</strong>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
              title={item.label}
            >
              <span className="nav-link-icon">{item.icon}</span>
              <span className="nav-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-copy">
            <p>Solo API pubbliche gratuite NBA</p>
            <p>UI in italiano</p>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="mobile-bar">
          <div className="mobile-actions">
            <button type="button" className="menu-button" onClick={() => setMenuOpen((open) => !open)}>
              <span className="menu-button-icon">
                <SidebarIcon>
                  <path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </SidebarIcon>
              </span>
              <span>Menu</span>
            </button>
          </div>
          <Link to="/" className="mobile-brand">
            NBA 2025-2026
          </Link>
        </header>
        <main className="page-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
