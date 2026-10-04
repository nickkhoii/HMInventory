"use client";
import { useState } from "react";
import { Download, Printer, FileText } from "lucide-react";
import { reportKinds, isBorrowReport } from "@/lib/report-kinds";
import { borrowerTypes, borrowStatuses } from "@/lib/borrow-rules";
import { api, Empty, Field, Select, formData, label, money } from "./ui";
import { conditions } from "@/lib/validation";
import type { Options, Report } from "./types";
export function ReportsView({ options }: { options: Options }) {
  const [kind, setKind] = useState("complete");
  const [report, setReport] = useState<Report>(),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function generate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = formData(e.currentTarget);
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) if (v) p.set(k, String(v));
    try {
      const result = await api<Report>(`reports?${p}`);
      setReport(result);
      setQuery(p.toString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">RECORDS YOU CAN RELY ON</span>
          <h1>Reports</h1>
          <p>
            Generate, export, and print your laboratory’s inventory records.
          </p>
        </div>
      </div>
      <section className="panel no-print">
        <form onSubmit={generate}>
          <div className="filters">
            <Select
              name="kind"
              title="Report type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {reportKinds.map((k) => (
                <option key={k} value={k}>
                  {label(k)} report
                </option>
              ))}
            </Select>
            <Field name="from" title="Start date" type="date" />
            <Field name="to" title="End date" type="date" />
            <Field name="search" title="Search item / borrower / transaction" />
            {isBorrowReport(kind) && (
              <>
                <Select
                  key={`borrower-${kind}`}
                  name="borrowerType"
                  title="Borrower type"
                >
                  <option value="">All borrowers</option>
                  {borrowerTypes.map((t) => (
                    <option key={t} value={t}>
                      {label(t)}
                    </option>
                  ))}
                </Select>
                <Select
                  key={`status-${kind}`}
                  name="status"
                  title="Borrow status"
                >
                  <option value="">All statuses</option>
                  {borrowStatuses.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </Select>
                <Field
                  name="dueFrom"
                  title="Expected return from"
                  type="date"
                />
                <Field name="dueTo" title="Expected return to" type="date" />
              </>
            )}
            <Select name="category" title="Category">
              <option value="">All categories</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select name="location" title="Location">
              <option value="">All locations</option>
              {options.locations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select name="condition" title="Condition">
              <option value="">All conditions</option>
              {conditions.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </Select>
            <Select name="stock" title="Stock status">
              <option value="">All levels</option>
              {["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK"].map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </Select>
            <Select
              key={kind}
              name="archived"
              title="Inventory status"
              defaultValue={
                [
                  "stock-in",
                  "stock-out",
                  "damaged",
                  "repair",
                  "lost",
                  "disposal",
                ].includes(kind) || isBorrowReport(kind)
                  ? "all"
                  : "false"
              }
            >
              <option value="all">All inventory, including archived</option>
              <option value="false">Active inventory</option>
              <option value="true">Archived inventory</option>
            </Select>
            {["damaged", "lost"].includes(kind) && (
              <Select key={kind} name="status" title="Record status">
                <option value="">All statuses</option>
                {(kind === "damaged"
                  ? [
                      "FOR_ASSESSMENT",
                      "FOR_REPAIR",
                      "REPAIRED",
                      "BEYOND_REPAIR",
                      "DISPOSED",
                    ]
                  : [
                      "MISSING",
                      "UNDER_INVESTIGATION",
                      "RECOVERED",
                      "DECLARED_LOST",
                    ]
                ).map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button disabled={busy}>
              <FileText size={17} />
              {busy ? "Generating…" : "Generate report"}
            </button>
          </div>
        </form>
      </section>
      {report ? (
        <section className="panel report-sheet">
          <div className="report-actions no-print">
            <a
              className="button secondary"
              href={`/api/reports?${query}&format=csv`}
            >
              <Download size={16} />
              CSV
            </a>
            <a
              className="button secondary"
              href={`/api/reports?${query}&format=pdf`}
            >
              <Download size={16} />
              PDF
            </a>
            <button className="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print
            </button>
          </div>
          <div className="report-heading">
            <span className="eyebrow">
              {report.institution} · {report.laboratory}
            </span>
            <h2>{report.header}</h2>
            <h3>{report.title}</h3>
            <p>
              Generated:{" "}
              {new Date(report.generatedAt).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })}
            </p>
            <small>{report.filters}</small>
          </div>
          {report.rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {report.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="No records match the report criteria" />
          )}
          <div className="report-totals">
            <strong>{report.rows.length} records</strong>
            <strong>Total quantity: {report.totalQuantity}</strong>
            {report.totalValue !== null && (
              <strong>Total value: {money(report.totalValue)}</strong>
            )}
          </div>
        </section>
      ) : (
        <section className="panel">
          <Empty text="Choose report criteria and generate a report" />
        </section>
      )}
    </>
  );
}
