import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "app-shell-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-toggle sidebar-toggle-top"
          aria-label={sidebarCollapsed ? "Espandi menu" : "Riduci menu"}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        >
          <span className="sidebar-toggle-icon" aria-hidden="true">
            <SidebarIcon>
              <path d="m14 6-6 6 6 6M10 12h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </SidebarIcon>
          </span>
        </button>
        <div className="sidebar-header">
          <Link to="/" className="brand-mark" onClick={closeSidebar}>
            <span className="brand-logo" aria-hidden="true">
              <img src={NBA_WIKIPEDIA_LOGO} alt="" className="brand-logo-image" />
            </span>
            <strong className="brand-title">NBA Dashboard</strong>
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
              onClick={closeSidebar}
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
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Chiudi menu"
          onClick={closeSidebar}
        />
      ) : null}

      <div className="main-shell">
        <div className="mobile-bar">
          <Link to="/" className="mobile-brand" onClick={closeSidebar}>
            NBA Dashboard
          </Link>
          <div className="mobile-actions">
            <button type="button" className="menu-button" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>
              <span className="menu-button-icon" aria-hidden="true">
                <SidebarIcon>
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </SidebarIcon>
              </span>
              <span>{sidebarOpen ? "Chiudi" : "Menu"}</span>
            </button>
          </div>
        </div>
        <main className="page-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
