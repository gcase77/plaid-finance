import { NavLink, Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand">G Case Financial Insights</span>
          <ul className="navbar-nav">
            <li className="nav-item"><NavLink className="nav-link" to="/" end>Main</NavLink></li>
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
