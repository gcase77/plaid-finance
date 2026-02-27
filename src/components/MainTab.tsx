import { useState, type FormEvent } from "react";
import type { Account, Item } from "./types";
import LoadingSpinner from "./shared/LoadingSpinner";

type MainTabProps = {
  isAuthed: boolean;
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
    isAuthed,
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
                <form onSubmit={signIn}>
                  <div className="mb-2"><input className="form-control" type="email" placeholder="Email" required value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} /></div>
                  <div className="mb-2"><input className="form-control" type="password" placeholder="Password" minLength={6} required value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} /></div>
                  <button className="btn btn-outline-primary w-100" type="submit" disabled={busyAuth}>Sign In</button>
                </form>
                <hr />
                <form onSubmit={signUp}>
                  <div className="mb-2"><input className="form-control" type="email" placeholder="New account email" required value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} /></div>
                  <div className="mb-2"><input className="form-control" type="password" placeholder="New account password" minLength={6} required value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} /></div>
                  <button className="btn btn-primary w-100" type="submit" disabled={busyAuth}>Create Account</button>
                </form>
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
                        <input className="form-range" type="range" min={1} max={730} step={1} value={historyDays} onChange={(e) => setHistoryDays(Number(e.target.value))} />
                      </div>
                      <div className="col-md-4">
                        <input className="form-control form-control-sm" type="number" min={1} max={730} value={historyDays} onChange={(e) => setHistoryDays(Math.min(730, Math.max(1, Number(e.target.value) || 1)))} />
                      </div>
                    </div>
                    <div className="d-flex justify-content-between small text-muted mb-2"><span>1</span><span>730</span></div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-success btn-sm" onClick={() => { linkBank(historyDays); setShowHistoryPicker(false); }}>Continue to Plaid</button>
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowHistoryPicker(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {loadingItems ? <LoadingSpinner message="Loading items..." /> : (
                <ul className="list-group">
                  {items.map((item) => (
                    <li key={item.id} className="list-group-item d-flex justify-content-between align-items-start">
                      <div>
                        <strong>{item.institution_name || item.id}</strong>
                        <div className="small text-muted">{accountsByItem[item.id]?.length || 0} accounts</div>
                      </div>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteItem(item.id)}>Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
