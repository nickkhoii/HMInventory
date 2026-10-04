"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  api,
  Loading,
  Empty,
  Badge,
  date,
  label,
  Pagination,
  Select,
  Field,
} from "./ui";
import { Dashboard, type DashboardData } from "./dashboard";
import { InventoryView, type InventoryPage } from "./inventory-view";
import { LookupView } from "./lookup-view";
import { MovementForm } from "./movement-form";
import { IncidentView } from "./incident-view";
import { ReportsView } from "./reports-view";
import { SettingsView, type SettingsData } from "./settings-view";
import type { Options, Lookup, Transaction, Incident } from "./types";
type Activity = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
};
type Paged<T> = { items: T[]; total: number; page: number };
type Data =
  | DashboardData
  | InventoryPage
  | Lookup[]
  | Incident[]
  | SettingsData
  | Paged<Transaction>
  | Paged<Activity>;
const initialOptions: Options = { categories: [], locations: [], items: [] };
export function Workspace({ section }: { section: string }) {
  const params = useSearchParams();
  const [data, setData] = useState<Data>(),
    [options, setOptions] = useState<Options>(initialOptions),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [version, setVersion] = useState(0);
  const query = params.toString();
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const needsOptions = [
          "inventory",
          "stock-in",
          "stock-out",
          "adjustments",
          "damaged",
          "lost",
          "disposal",
          "reports",
        ].includes(section);
        const endpoint = [
          "stock-in",
          "stock-out",
          "adjustments",
          "reports",
        ].includes(section)
          ? null
          : section;
        const [records, opts] = await Promise.all([
          endpoint
            ? api<Data>(`${endpoint}?${query}`)
            : Promise.resolve(undefined),
          needsOptions
            ? api<Options>("options")
            : Promise.resolve(initialOptions),
        ]);
        if (alive) {
          setData(records);
          setOptions(opts);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [section, query, version]);
  function changeParams(p: URLSearchParams) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${p.size ? `?${p}` : ""}`,
    );
  }
  const movement = ["stock-in", "stock-out", "adjustments"].includes(section);
  return (
    <>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {loading ? (
        <Loading />
      ) : error ? (
        <section className="panel">
          <p className="alert error" role="alert">
            {error}
          </p>
          <button onClick={refresh}>Try again</button>
        </section>
      ) : (
        <>
          {section === "dashboard" && (
            <Dashboard data={data as DashboardData} />
          )}
          {section === "inventory" && (
            <InventoryView
              data={data as InventoryPage}
              options={options}
              params={params}
              setParams={changeParams}
              refresh={refresh}
              notify={notify}
            />
          )}
          {["categories", "locations"].includes(section) && (
            <LookupView
              resource={section}
              data={data as Lookup[]}
              refresh={refresh}
              notify={notify}
            />
          )}
          {movement && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">INVENTORY MOVEMENTS</span>
                  <h1>
                    {section === "stock-in"
                      ? "Stock In"
                      : section === "stock-out"
                        ? "Stock Out"
                        : "Inventory Adjustments"}
                  </h1>
                  <p>
                    {section === "stock-in"
                      ? "Record incoming equipment and supplies."
                      : section === "stock-out"
                        ? "Record outgoing units with a documented purpose."
                        : "Correct discrepancies with a recorded reason."}
                  </p>
                </div>
                <Link className="button secondary" href="/transactions">
                  View history
                </Link>
              </div>
              <section className="panel form-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Record a stock movement</h2>
                    <p>Balances and audit records are saved together.</p>
                  </div>
                </div>
                <MovementForm
                  onStart={() => setToast("")}
                  type={
                    section === "stock-in"
                      ? "STOCK_IN"
                      : section === "stock-out"
                        ? "STOCK_OUT"
                        : "ADJUSTMENT"
                  }
                  options={options}
                  onSave={() => {
                    refresh();
                    notify("Stock movement recorded successfully");
                  }}
                />
              </section>
            </>
          )}
          {["damaged", "lost", "disposal"].includes(section) && (
            <IncidentView
              resource={section}
              data={data as Incident[]}
              options={options}
              refresh={refresh}
              notify={notify}
            />
          )}
          {section === "reports" && <ReportsView options={options} />}
          {section === "settings" && (
            <SettingsView data={data as SettingsData} notify={notify} />
          )}
          {section === "transactions" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PERMANENT INVENTORY RECORDS</span>
                  <h1>Transaction History</h1>
                  <p>Follow every quantity change and its resulting balance.</p>
                </div>
              </div>
              <section className="panel">
                <form
                  className="filters"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const p = new URLSearchParams();
                    new FormData(e.currentTarget).forEach((v, k) => {
                      if (v) p.set(k, String(v));
                    });
                    changeParams(p);
                  }}
                >
                  <Field
                    name="search"
                    title="Search item / code"
                    defaultValue={params.get("search") ?? ""}
                  />
                  <Select
                    name="type"
                    title="Type"
                    defaultValue={params.get("type") ?? ""}
                  >
                    <option value="">All movements</option>
                    {[
                      "INITIAL",
                      "STOCK_IN",
                      "STOCK_OUT",
                      "ADJUSTMENT",
                      "DAMAGE",
                      "REPAIR",
                      "LOST",
                      "RECOVERY",
                      "DISPOSAL",
                      "BORROW",
                      "RETURN",
                      "BORROW_CANCEL",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ))}
                  </Select>
                  <Field
                    name="from"
                    title="Start date"
                    type="date"
                    defaultValue={params.get("from") ?? ""}
                  />
                  <Field
                    name="to"
                    title="End date"
                    type="date"
                    defaultValue={params.get("to") ?? ""}
                  />
                  <button>Apply filters</button>
                </form>
                <Transactions
                  data={data as Paged<Transaction>}
                  onPage={(n) => {
                    const p = new URLSearchParams(params);
                    p.set("page", String(n));
                    changeParams(p);
                  }}
                />
              </section>
            </>
          )}
          {section === "activity" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ADMINISTRATOR AUDIT TRAIL</span>
                  <h1>Activity Logs</h1>
                  <p>A permanent record of system actions.</p>
                </div>
              </div>
              <section className="panel">
                {(data as Paged<Activity>).items.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Description</th>
                          <th>Date & time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data as Paged<Activity>).items.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <Badge value={a.action} />
                            </td>
                            <td>{a.description}</td>
                            <td>
                              {new Date(a.createdAt).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty />
                )}
                <Pagination
                  page={(data as Paged<Activity>).page}
                  total={(data as Paged<Activity>).total}
                  size={30}
                  onChange={(n) => {
                    const p = new URLSearchParams(params);
                    p.set("page", String(n));
                    changeParams(p);
                  }}
                />
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
export function Transactions({
  data,
  onPage,
}: {
  data: Paged<Transaction>;
  onPage: (n: number) => void;
}) {
  return (
    <>
      {data.items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transaction / date</th>
                <th>Inventory item</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Total balance</th>
                <th>Available balance</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span
                      className="transaction-code"
                      title={t.transactionNumber}
                    >
                      {t.transactionNumber}
                    </span>
                    <small>{date(t.transactionDate)}</small>
                    {t.borrowTransactionId && (
                      <small>
                        <Link
                          href={`/borrowing/${t.borrowTransactionId}`}
                          className="text-link"
                        >
                          Borrowing details
                        </Link>
                      </small>
                    )}
                  </td>
                  <td>
                    <Link href={`/inventory/${t.itemId}`}>
                      <strong>{t.item?.name}</strong>
                      <small>{t.item?.inventoryCode}</small>
                    </Link>
                  </td>
                  <td>
                    <Badge value={t.type} />
                  </td>
                  <td>{t.quantity}</td>
                  <td>
                    {t.previousQuantity} → {t.newQuantity}
                  </td>
                  <td>
                    {t.previousAvailable} → {t.newAvailable}
                  </td>
                  <td>{t.remarks || t.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
      <Pagination page={data.page} total={data.total} onChange={onPage} />
    </>
  );
}
