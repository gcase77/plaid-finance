import { useState } from "react";
import type { Account, Item } from "./types";
import LoadingSpinner from "./shared/LoadingSpinner";

type MainTabProps = {
  userEmail: string;
  signOut: () => void;
  linkBank: (daysRequested?: number) => void;
  loadingItems: boolean;
  items: Item[];
  accountsByItem: Record<string, Account[]>;
};

export default function MainTab(props: MainTabProps) {
  const {
    userEmail, signOut,
    linkBank, loadingItems, items, accountsByItem
  } = props;
  const [historyDays, setHistoryDays] = useState(730);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);

  return (
    <div className="row justify-content-center">
      <div className="col-md-5">
        <div className="card mx-auto" style={{ maxWidth: 480 }}>
          <div className="card-body">
            <h5 className="card-title">Authentication</h5>
            <div>
              <p className="mb-2">Signed in as: <strong>{userEmail}</strong></p>
              <button className="btn btn-outline-secondary w-100" onClick={signOut}>Sign Out</button>
            </div>
          </div>
        </div>
      </div>

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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
