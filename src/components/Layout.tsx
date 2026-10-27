import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { IconBookmark, IconBrain, IconHome, IconLayers, IconLibrary, IconSettings } from "../icons";
import { useStore } from "../store";

const NAV = [
  { to: "/", label: "Home", icon: IconHome, end: true },
  { to: "/explore", label: "Brain Lab", icon: IconBrain },
  { to: "/compare", label: "Compare", icon: IconLayers },
  { to: "/library", label: "Library", icon: IconLibrary },
  { to: "/saved", label: "Saved", icon: IconBookmark },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

export function Layout() {
  const { saved } = useStore();
  const { pathname } = useLocation();
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main navigation">
        <div className="logo" aria-hidden="true">
          <img src="/favicon.svg" width={34} height={34} alt="" />
        </div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <Icon size={20} />
            <span>
              {label}
              {to === "/saved" && saved.length > 0 && <span className="sr-only"> ({saved.length})</span>}
            </span>
          </NavLink>
        ))}
        <div className="spacer" />
      </nav>
      <main className="main" id="main">
        {/* Keyed by page, so moving to another page clears a crash. */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
