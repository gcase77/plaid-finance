import type { RefObject } from "react";
import type { Txn } from "./types";
import TransactionTable from "./shared/TransactionTable";

type VisualizePanelProps = {
  refreshVisualizations: () => void;
  applyVisualizeDatePreset: (preset: string) => void;
  visualizeDateStart: string;
  setVisualizeDateStart: (v: string) => void;
  visualizeDateEnd: string;
  setVisualizeDateEnd: (v: string) => void;
  loadingCharts: boolean;
  visualizeStatus: string;
  incomeCanvasRef: RefObject<HTMLCanvasElement | null>;
  spendingCanvasRef: RefObject<HTMLCanvasElement | null>;
  sankeyRef: RefObject<HTMLDivElement | null>;
  detailTitle: string;
  detailRows: Txn[];
};

export default function VisualizePanel(props: VisualizePanelProps) {
  const {
    refreshVisualizations, applyVisualizeDatePreset,
    visualizeDateStart, setVisualizeDateStart, visualizeDateEnd, setVisualizeDateEnd,
    loadingCharts, visualizeStatus,
    incomeCanvasRef, spendingCanvasRef, sankeyRef,
    detailTitle, detailRows
  } = props;

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="card-title mb-0">Visualizations</h5>
          <button className="btn btn-outline-secondary btn-sm" onClick={refreshVisualizations}>Refresh</button>
        </div>
        <div className="row g-2 mb-3">
          <div className="col-md-8">
            <label className="form-label mb-1">Date range</label>
            <div className="input-group">
              <input className="form-control" type="date" value={visualizeDateStart} onChange={(e) => setVisualizeDateStart(e.target.value)} />
              <input className="form-control" type="date" value={visualizeDateEnd} onChange={(e) => setVisualizeDateEnd(e.target.value)} />
            </div>
          </div>
          <div className="col-md-4">
            <label className="form-label mb-1">&nbsp;</label>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => applyVisualizeDatePreset("all")}>All</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => applyVisualizeDatePreset("last30")}>30d</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => applyVisualizeDatePreset("last365")}>365d</button>
            </div>
          </div>
        </div>
        <div className="small text-muted mb-3">{loadingCharts ? "Loading visualizations..." : visualizeStatus}</div>
        <div className="row g-3">
          <div className="col-md-6">
            <div className="border rounded p-2">
              <h6 className="mb-2">Income by Primary Category</h6>
              <canvas ref={incomeCanvasRef} height={220} />
            </div>
          </div>
          <div className="col-md-6">
            <div className="border rounded p-2">
              <h6 className="mb-2">Spending by Primary Category</h6>
              <canvas ref={spendingCanvasRef} height={220} />
            </div>
          </div>
        </div>
        <div className="mt-3 border rounded p-2">
          <h6 className="mb-2">Income/Spending Flow (Sankey)</h6>
          <div ref={sankeyRef} style={{ height: 360 }} />
        </div>
        <div className="mt-3">
          <h6 className="mb-2">{detailTitle}</h6>
          <TransactionTable 
            transactions={detailRows} 
            emptyMessage="No transactions loaded for selected chart segment"
            keyPrefix="detail"
          />
        </div>
      </div>
    </div>
  );
}
