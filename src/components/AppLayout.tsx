import { Link, NavLink, Outlet } from "react-router-dom";

/**
 * Renders the application's shared layout with a top navigation bar and main content area.
 *
 * The navigation bar includes a brand link (logo) to the landing page and navigation links for Home, Transactions, and Tools. The main content area is a fluid container that renders the active child route via React Router's Outlet.
 *
 * @returns The layout element containing the navbar and a container that renders child routes.
 */
export default function AppLayout() {
  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <Link className="navbar-brand py-1" to="/l" aria-label="Funds Up landing page">
            <img src="/funds-up-logo.svg" alt="Funds Up" style={{ height: 36, width: "auto", display: "block" }} />
          </Link>
          <ul className="navbar-nav">
            <li className="nav-item"><NavLink className="nav-link" to="/" end>Home</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/transactions">Transactions</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/tools">Tools</NavLink></li>
          </ul>
        </div>
      </nav>
      <div className="container-fluid px-4 mt-4">
        <Outlet />
      </div>
    </div>
  );
}
