// A spreadsheet window as it looks on a Mac, with Tandrix ringing the control to use next. Drawn in
// code (decorative, aria-hidden); the copy beside it says what it shows.
import { Ring, Win } from "./parts";
import x from "./Excel.module.css";

const cols = ["A", "B", "C", "D", "E", "F", "G"];
const rows: Array<[string, string, number, number, number]> = [
  ["North", "Kettles", 12480, 13920, 15110],
  ["North", "Toasters", 8340, 7910, 9260],
  ["South", "Kettles", 10210, 11450, 11980],
  ["South", "Toasters", 6890, 7340, 8120],
  ["East", "Kettles", 9720, 10880, 12340],
  ["East", "Toasters", 5410, 6020, 6610],
  ["West", "Kettles", 11030, 11870, 13450],
  ["West", "Toasters", 7260, 7690, 8410],
];
const n = (v: number) => v.toLocaleString("en-US");

function RibbonButton({ label, big, icon }: { label: string; big?: boolean; icon: string }) {
  return (
    <span className={big ? x.rbBig : x.rb}>
      <span className={`${x.ri} ${x[icon] ?? ""}`} />
      <span>{label}</span>
    </span>
  );
}

export function ExcelScene({ pointer = true }: { pointer?: boolean }) {
  return (
    <Win title="Q3 sales.xlsx" app="excel">
      <div className={x.tabs}>
        {["Home", "Insert", "Draw", "Page Layout", "Formulas", "Data", "Review", "View"].map(
          (t) => (
            <span key={t} className={t === "Insert" ? x.tabOn : undefined}>
              {t}
            </span>
          ),
        )}
      </div>
      <div className={x.ribbon}>
        <span className={x.group}>
          <span className={x.target}>
            <RibbonButton label="PivotTable" big icon="iPivot" />
            {pointer ? <Ring caption="Click Insert, then PivotTable" place="right" /> : null}
          </span>
          <RibbonButton label="Recommended PivotTables" big icon="iRec" />
          <RibbonButton label="Table" big icon="iTable" />
        </span>
        <span className={x.group}>
          <RibbonButton label="Pictures" big icon="iPic" />
          <RibbonButton label="Shapes" big icon="iShape" />
        </span>
        <span className={x.group}>
          <RibbonButton label="Recommended Charts" big icon="iChart" />
          <RibbonButton label="Column" big icon="iCol" />
          <RibbonButton label="Line" big icon="iLine" />
          <RibbonButton label="Pie" big icon="iPie" />
        </span>
      </div>
      <div className={x.formula}>
        <span className={x.nameBox}>A1</span>
        <span className={x.fx}>fx</span>
        <span>Region</span>
      </div>
      <div className={x.grid}>
        <span className={x.corner} />
        {cols.map((c) => (
          <span key={c} className={`${x.colHead} ${"ABCDE".includes(c) ? x.headSel : ""}`}>
            {c}
          </span>
        ))}
        <span className={`${x.rowHead} ${x.headSel}`}>1</span>
        {["Region", "Product", "July", "August", "September"].map((h, i) => (
          <span key={h} className={`${x.cell} ${x.th} ${i > 1 ? x.num : ""} ${x.sel}`}>
            {h}
          </span>
        ))}
        <span className={x.cell} />
        <span className={x.cell} />
        {rows.map((r, i) => (
          <Row key={i} i={i + 2} r={r} />
        ))}
        {[10, 11, 12].map((i) => (
          <Empty key={i} i={i} />
        ))}
        <span className={x.selBox} />
      </div>
      <div className={x.sheets}>
        <span className={x.sheetOn}>Sales</span>
        <span>Targets</span>
        <span className={x.plus}>+</span>
        <span className={x.status}>Average: 9,661 · Count: 45 · Sum: 289,840</span>
      </div>
    </Win>
  );
}

function Row({ i, r }: { i: number; r: [string, string, number, number, number] }) {
  return (
    <>
      <span className={`${x.rowHead} ${x.headSel}`}>{i}</span>
      <span className={`${x.cell} ${x.sel}`}>{r[0]}</span>
      <span className={`${x.cell} ${x.sel}`}>{r[1]}</span>
      <span className={`${x.cell} ${x.num} ${x.sel}`}>{n(r[2])}</span>
      <span className={`${x.cell} ${x.num} ${x.sel}`}>{n(r[3])}</span>
      <span className={`${x.cell} ${x.num} ${x.sel}`}>{n(r[4])}</span>
      <span className={x.cell} />
      <span className={x.cell} />
    </>
  );
}

function Empty({ i }: { i: number }) {
  return (
    <>
      <span className={x.rowHead}>{i}</span>
      {cols.map((c) => (
        <span key={c} className={x.cell} />
      ))}
    </>
  );
}
