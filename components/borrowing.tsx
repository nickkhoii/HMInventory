"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { borrowerTypes, borrowStatuses } from "@/lib/borrow-rules";
import {
  api,
  Loading,
  Empty,
  Field,
  Select,
  Pagination,
  Badge,
  date,
  label,
  formData,
} from "./ui";
import { BorrowForm } from "./borrow-form";
import { ReturnForm } from "./return-form";
import type { Options, BorrowRecord } from "./types";
type Page = { items: BorrowRecord[]; page: number; total: number };
export function BorrowModule({
  mode,
}: {
  mode: "create" | "return" | "history";
}) {
  const params = useSearchParams(),
    query = params.toString();
  const [data, setData] = useState<Page>(),
    [options, setOptions] = useState<Options>(),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setError("");
      setData(undefined);
      setOptions(undefined);
      const p = new URLSearchParams(query);
      if (mode === "return") p.set("open", "true");
      (mode === "create"
        ? api<Options>("options").then((d) => {
            if (alive) setOptions(d);
          })
        : api<Page>(`borrowing?${p}`).then((d) => {
            if (alive) setData(d);
          })
      ).catch((e) => {
        if (alive) setError(e.message);
      });
    });
    return () => {
      alive = false;
    };
  }, [mode, query]);
  function update(p: URLSearchParams) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${p.size ? `?${p}` : ""}`,
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOANS & ACCOUNTABILITY</span>
          <h1>
            {mode === "create"
              ? "Borrow Items"
              : mode === "return"
                ? "Return Items"
                : "Borrowing History"}
          </h1>
          <p>
            {mode === "create"
              ? "Release multiple inventory items in one recorded loan."
              : mode === "return"
                ? "Find an open loan and record full, partial, damaged or lost returns."
                : "Follow each borrower, release, return and outstanding balance."}
          </p>
        </div>
        {mode !== "create" && (
          <Link href="/borrow-items" className="button">
            New borrowing
          </Link>
        )}
      </div>
      {error ? (
        <p role="alert" className="alert error">
          {error}
        </p>
      ) : mode === "create" ? (
        options ? (
          <BorrowForm options={options} />
        ) : (
          <Loading />
        )
      ) : (
        <section className="panel">
          <form
            className="filters"
            key={query}
            onSubmit={(e) => {
              e.preventDefault();
              update(
                new URLSearchParams(
                  Object.entries(formData(e.currentTarget))
                    .filter(([, v]) => v)
                    .map(([k, v]) => [k, String(v)]),
                ),
              );
            }}
          >
            <Field
              name="search"
              title="Search transaction, borrower, ID or item"
              defaultValue={params.get("search") ?? ""}
            />
            <Select
              name="borrowerType"
              title="Borrower type"
              defaultValue={params.get("borrowerType") ?? ""}
            >
              <option value="">All borrowers</option>
              {borrowerTypes.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </Select>
            <Select
              name="status"
              title="Borrow status"
              defaultValue={params.get("status") ?? ""}
            >
              <option value="">
                {mode === "return" ? "All open loans" : "All statuses"}
              </option>
              {borrowStatuses
                .filter(
                  (s) =>
                    mode !== "return" || !["RETURNED", "CANCELLED"].includes(s),
                )
                .map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
            </Select>
            <Field
              name="from"
              title="Borrowed from"
              type="date"
              defaultValue={params.get("from") ?? ""}
            />
            <Field
              name="to"
              title="Borrowed to"
              type="date"
              defaultValue={params.get("to") ?? ""}
            />
            <Field
              name="dueFrom"
              title="Expected return from"
              type="date"
              defaultValue={params.get("dueFrom") ?? ""}
            />
            <Field
              name="dueTo"
              title="Expected return to"
              type="date"
              defaultValue={params.get("dueTo") ?? ""}
            />
            <Select
              name="sort"
              title="Sort by"
              defaultValue={params.get("sort") ?? "borrowedDate"}
            >
              {[
                ["borrowedDate", "Date borrowed"],
                ["expectedReturnDate", "Expected return"],
                ["borrowerName", "Borrower"],
                ["transactionNumber", "Transaction number"],
                ["finalReturnDate", "Final return"],
              ].map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Select>
            <Select
              name="direction"
              title="Order"
              defaultValue={params.get("direction") ?? "desc"}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
            <button>Apply filters</button>
          </form>
          {!data ? (
            <Loading />
          ) : data.items.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Transaction / Borrower</th>
                      <th>Type / ID</th>
                      <th>Borrowed / Expected</th>
                      <th>Final return</th>
                      <th>Items / Units</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Link
                            className="item-link"
                            href={`/borrowing/${b.id}`}
                          >
                            <strong>{b.transactionNumber}</strong>
                            <small>{b.borrowerName}</small>
                          </Link>
                        </td>
                        <td>
                          {label(b.borrowerType)}
                          <small>{b.borrowerIdNumber || "—"}</small>
                        </td>
                        <td>
                          {date(b.borrowedDate)}
                          <small>Due {date(b.expectedReturnDate)}</small>
                        </td>
                        <td>
                          {b.finalReturnDate ? date(b.finalReturnDate) : "—"}
                        </td>
                        <td>
                          {b.items.length} lines
                          <small>{b.quantityBorrowed} units</small>
                        </td>
                        <td>{b.quantityOutstanding}</td>
                        <td>
                          <Badge value={b.status} />
                          {b.status === "OVERDUE" && (
                            <small>{b.daysOverdue} days overdue</small>
                          )}
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/borrowing/${b.id}`}
                          >
                            {mode === "return"
                              ? "Record return"
                              : "View details"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.page}
                total={data.total}
                onChange={(page) => {
                  const p = new URLSearchParams(params);
                  p.set("page", String(page));
                  update(p);
                }}
              />
            </>
          ) : (
            <Empty text="No borrowing transactions match these filters" />
          )}
        </section>
      )}
    </>
  );
}
export function BorrowDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<BorrowRecord>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState(false),
    [toast, setToast] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      setRecord(await api<BorrowRecord>(`borrowing/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (error && !record)
    return (
      <p role="alert" className="alert error">
        {error}
      </p>
    );
  if (!record) return <Loading />;
  const fields = {
    Borrower: record.borrowerName,
    "Borrower type": label(record.borrowerType),
    "ID number": record.borrowerIdNumber,
    "Course / Program": record.program,
    Department: record.department,
    "Year / Section": record.yearSection,
    Contact: record.contactNumber,
    "Date borrowed": date(record.borrowedDate),
    "Expected return": date(record.expectedReturnDate),
    "Final return": record.finalReturnDate ? date(record.finalReturnDate) : "—",
    Purpose: record.purpose,
    Remarks: record.remarks,
  };
  const events = [
    {
      key: "borrow",
      date: record.borrowedDate,
      createdAt: record.createdAt,
      title: "Borrow Transaction Created",
      description: `${record.borrowerName} borrowed ${record.quantityBorrowed} units. ${record.purpose}`,
    },
    ...(record.returns ?? []).map((r) => ({
      key: r.id,
      date: r.returnDate,
      createdAt: r.createdAt,
      title: r.returnNumber,
      description:
        r.items
          .map(
            (i) =>
              `${record.items.find((b) => b.id === i.borrowTransactionItemId)?.itemName}: ${i.quantityReturned} ${label(i.returnCondition)}${i.damageDescription ? ` — ${i.damageDescription}` : ""}${i.actionRequired ? ` — Action: ${i.actionRequired}` : ""}${i.remarks ? ` — ${i.remarks}` : ""}`,
          )
          .join("; ") + (r.remarks ? ` · ${r.remarks}` : ""),
    })),
    ...(record.cancelledAt
      ? [
          {
            key: "cancel",
            date: record.cancelledAt,
            createdAt: record.cancelledAt,
            title: "Borrow Transaction Cancelled",
            description: record.cancelReason,
          },
        ]
      : []),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  return (
    <>
      <Link href="/borrowing-history" className="text-link back-link">
        ← Borrowing history
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{record.borrowerName}</span>
          <h1>{record.transactionNumber}</h1>
          <p>
            {record.quantityOutstanding} units outstanding
            {record.status === "OVERDUE"
              ? ` · ${record.daysOverdue} days overdue`
              : ""}
          </p>
        </div>
        <Badge value={record.status} />
      </div>
      {toast && (
        <p className="toast" role="status">
          {toast}
        </p>
      )}
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <section className="panel detail-panel">
        <dl className="detail-grid">
          {Object.entries(fields).map(([title, value]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Borrowed items</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Borrowed</th>
                <th>Returned / Reported lost</th>
                <th>Cancelled</th>
                <th>Outstanding</th>
                <th>Condition before release</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {record.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link
                      href={`/inventory/${i.inventoryItemId}`}
                      className="item-link"
                    >
                      <strong>{i.itemName}</strong>
                      <small>{i.inventoryCode}</small>
                    </Link>
                  </td>
                  <td>{i.quantityBorrowed}</td>
                  <td>{i.quantityReturned}</td>
                  <td>{i.quantityCancelled}</td>
                  <td>{i.quantityOutstanding}</td>
                  <td>{label(i.conditionBeforeRelease)}</td>
                  <td>
                    {record.status === "CANCELLED"
                      ? "Cancelled"
                      : i.quantityOutstanding === 0
                        ? "Returned"
                        : i.quantityReturned > 0
                          ? "Partial"
                          : "Borrowed"}
                  </td>
                  <td>{i.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Returned quantities include damaged returns and items reported lost.
          Only usable returns re-enter available stock.
        </p>
      </section>
      {record.quantityOutstanding > 0 && (
        <ReturnForm
          key={`${record.id}:${record.quantityReturned}`}
          record={record}
          onSave={() => {
            setToast("Return recorded. Inventory balances updated.");
            void load();
          }}
        />
      )}
      {record.quantityReturned === 0 && record.quantityOutstanding > 0 && (
        <section className="panel form-panel">
          <button
            type="button"
            className="secondary"
            onClick={() => setCancel((v) => !v)}
          >
            Cancel borrowing
          </button>
          {cancel && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                try {
                  await api(`borrowing/${id}`, "PATCH", {
                    ...formData(e.currentTarget),
                    action: "cancel",
                  });
                  setCancel(false);
                  await load();
                  setToast("Borrowing cancelled and available stock restored");
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="hint">
                Cancel only if the release did not take place. This preserves
                history and restores all borrowed units.
              </p>
              <Field name="reason" title="Cancellation reason" required />
              <div className="form-actions">
                <button disabled={busy}>Confirm cancellation</button>
              </div>
            </form>
          )}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Transaction timeline</h2>
        </div>
        <ol className="borrow-timeline">
          {events.map((e) => (
            <li key={e.key}>
              <strong>{e.title}</strong>
              <time>{date(e.date)}</time>
              <p>{e.description}</p>
              <small>Recorded {date(e.createdAt)}</small>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
