import { useState, type FormEvent } from "react";
import type { Account, AuthMode, Item } from "./types";
import LoadingSpinner from "./shared/LoadingSpinner";

type MainTabProps = {
  isAuthed: boolean;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  signInEmail: string;
  setSignInEmail: (v: string) => void;
  signInPassword: string;
  setSignInPassword: (v: string) => void;
  signUpEmail: string;
  setSignUpEmail: (v: string) => void;
  signUpPassword: string;
  setSignUpPassword: (v: string) => void;
  busyAuth: boolean;
  signIn: (e: FormEvent) => void;
  signUp: (e: FormEvent) => void;
  authError: boolean;
  authStatus: string;
  userEmail: string;
  signOut: () => void;
  linkBank: (daysRequested?: number) => void;
  loadingItems: boolean;
  items: Item[];
  accountsByItem: Record<string, Account[]>;
  deleteItem: (id: string) => void;
};

export default function MainTab(props: MainTabProps) {
  const {
    isAuthed, authMode, setAuthMode,
    signInEmail, setSignInEmail, signInPassword, setSignInPassword,
    signUpEmail, setSignUpEmail, signUpPassword, setSignUpPassword,
    busyAuth, signIn, signUp, authError, authStatus, userEmail, signOut,
    linkBank, loadingItems, items, accountsByItem, deleteItem
  } = props;
  const [historyDays, setHistoryDays] = useState(730);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);

  return (
    <div className="row justify-content-center">
      <div className="col-md-5">
        <div className="card mx-auto" style={{ maxWidth: 480 }}>
          <div className="card-body">
            <h5 className="card-title">Authentication</h5>
            {!isAuthed ? (
              <div>
                <div className="btn-group w-100 mb-3">
                  <button className={`btn btn-outline-secondary ${authMode === "existing" ? "active" : ""}`} type="button" onClick={() => setAuthMode("existing")}>Existing User</button>
                  <button className={`btn btn-outline-secondary ${authMode === "new" ? "active" : ""}`} type="button" onClick={() => setAuthMode("new")}>New User</button>
                </div>
                {authMode === "existing" ? (
                  <form onSubmit={signIn}>
                    <div className="mb-2"><input className="form-control" type="email" placeholder="Email" required value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} /></div>
                    <div className="mb-2"><input className="form-control" type="password" placeholder="Password" minLength={6} required value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} /></div>
                    <button className="btn btn-outline-primary w-100" type="submit" disabled={busyAuth}>Sign In</button>
                  </form>
                ) : (
                  <form onSubmit={signUp}>
                    <div className="mb-2"><input className="form-control" type="email" placeholder="Email" required value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} /></div>
                    <div className="mb-2"><input className="form-control" type="password" placeholder="Password" minLength={6} required value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} /></div>
                    <button className="btn btn-primary w-100" type="submit" disabled={busyAuth}>Create Account</button>
                  </form>
                )}
                <small className={`${authError ? "text-danger" : "text-muted"} d-block mt-2`}>{authStatus}</small>
              </div>
            ) : (
              <div>
                <p className="mb-2">Signed in as: <strong>{userEmail}</strong></p>
                <button className="btn btn-outline-secondary w-100" onClick={signOut}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isAuthed && (
        <div className="col-md-7">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Your Banks</h5>
              <div className="mb-3">
                {!showHistoryPicker ? (
                  <button className="btn btn-success" onClick={() => setShowHistoryPicker(true)}>Link Bank</button>
                ) : (
                  <div className="border rounded p-3">
                    <label className="form-label mb-1">Allow this app to access transactions up to <strong>{historyDays}</strong> days ago</label>
                    <div className="row g-2 align-items-center">
                      <div className="col-md-8">
                        <input
                          className="form-range"
                          type="range"
                          min={1}
                          max={730}
                          step={1}
                          value={historyDays}
                          onChange={(e) => setHistoryDays(Number(e.target.value))}
                        />
                      </div>
                      <div className="col-md-4">
                        <input
                          className="form-control form-control-sm"
                          type="number"
                          min={1}
                          max={730}
                          value={historyDays}
                          onChange={(e) => setHistoryDays(Math.min(730, Math.max(1, Number(e.target.value) || 1)))}
                        />
                      </div>
                    </div>
                    <div className="d-flex justify-content-between small text-muted mb-2">
                      <span>1</span>
                      <span>730</span>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-success btn-sm" onClick={() => { linkBank(historyDays); setShowHistoryPicker(false); }}>
                        Continue to Login
                      </button>
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowHistoryPicker(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <h6>Linked Banks:</h6>
              {loadingItems ? (
                <LoadingSpinner message="Loading banks..." />
              ) : items.length === 0 ? (
                <div className="text-muted">No banks linked</div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="border p-2 mb-2 rounded">
                    <div className="d-flex justify-content-between align-items-center">
                      <span><strong>{item.institution_name || "Unknown"}</strong> ({item.id.slice(0, 8)}...)</span>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteItem(item.id)}>Delete</button>
                    </div>
                    <div className="mt-2 ps-2">
                      <small className="text-muted fw-bold">Connected Accounts</small>
                      {(accountsByItem[item.id] || []).length ? (
                        <ul className="mb-0 small">
                          {(accountsByItem[item.id] || []).map((a) => <li key={a.id}>{a.name || a.official_name || a.id}{a.mask ? ` ···${a.mask}` : ""} ({a.type || "unknown"})</li>)}
                        </ul>
                      ) : (
                        <p className="mb-0 small text-muted">None</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
