"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { borrowSchema } from "@/lib/borrow-validation";
import { borrowerTypes } from "@/lib/borrow-rules";
import { api, Field, Select, formData, label, today } from "./ui";
import type { Options } from "./types";
import { requestKey, type PendingRequest } from "@/lib/request-id";
type Line = {
  key: number;
  inventoryItemId: string;
  quantity: string;
  conditionBeforeRelease: string;
  remarks: string;
};
const blank = (key: number): Line => ({
  key,
  inventoryItemId: "",
  quantity: "1",
  conditionBeforeRelease: "GOOD",
  remarks: "",
});
export function BorrowForm({ options }: { options: Options }) {
  const router = useRouter(),
    key = useRef(1),
    requestId = useRef<PendingRequest>(null);
  const [lines, setLines] = useState<Line[]>([blank(0)]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function change(index: number, patch: Partial<Line>) {
    setLines((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const parsed = borrowSchema.safeParse({
        ...formData(event.currentTarget),
        items: lines.map(({ key: _key, ...line }) => {
          void _key;
          return line;
        }),
      });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
      requestId.current = requestKey(requestId.current, parsed.data);
      const result = await api<{ id: string }>("borrowing", "POST", {
        ...parsed.data,
        requestId: requestId.current.id,
      });
      router.push(`/borrowing/${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <section className="panel form-panel">
        <h2>Borrower information</h2>
        <p className="hint">
          The administrator records this loan. Borrowers do not have accounts.
        </p>
        <div className="form-grid">
          <Field name="borrowerName" title="Borrower name" required />
          <Select
            name="borrowerType"
            title="Borrower type"
            defaultValue="STUDENT"
            required
          >
            {borrowerTypes.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </Select>
          <Field name="borrowerIdNumber" title="ID number" />
          <Field name="program" title="Course / Program" />
          <Field name="department" title="Department / Organization" />
          <Field name="yearSection" title="Year level / Section" />
          <Field name="contactNumber" title="Contact number" />
          <Field
            name="borrowedDate"
            title="Date borrowed"
            type="date"
            defaultValue={today()}
            required
          />
          <Field
            name="expectedReturnDate"
            title="Expected return date"
            type="date"
            defaultValue={today()}
            required
          />
          <Field name="purpose" title="Purpose" required />
          <Field name="remarks" title="Borrowing remarks" />
        </div>
      </section>
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>Items to release</h2>
            <p>
              Borrowing reduces available stock and keeps total quantity
              unchanged.
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={busy || lines.length >= 50}
            onClick={() => setLines((rows) => [...rows, blank(key.current++)])}
          >
            Add item
          </button>
        </div>
        {lines.map((line, index) => {
          const item = options.items.find((i) => i.id === line.inventoryItemId);
          return (
            <div className="borrow-line" key={line.key}>
              <div className="form-grid">
                <Select
                  name={`item-${index}`}
                  title={`Inventory item ${index + 1}`}
                  required
                  value={line.inventoryItemId}
                  onChange={(e) => {
                    const found = options.items.find(
                      (i) => i.id === e.target.value,
                    );
                    change(index, {
                      inventoryItemId: e.target.value,
                      conditionBeforeRelease:
                        found &&
                        ["NEW", "GOOD", "FAIR"].includes(found.condition)
                          ? found.condition
                          : "GOOD",
                    });
                  }}
                >
                  <option value="">Select inventory</option>
                  {options.items
                    .filter(
                      (i) =>
                        i.id === line.inventoryItemId ||
                        !lines.some((l) => l.inventoryItemId === i.id),
                    )
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.inventoryCode} · {i.name} ({i.availableQuantity}{" "}
                        available)
                      </option>
                    ))}
                </Select>
                <label className="field">
                  <span>Quantity borrowed {index + 1}</span>
                  <input
                    type="number"
                    min={1}
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      change(index, { quantity: e.target.value })
                    }
                  />
                </label>
                <Select
                  name={`condition-${index}`}
                  title={`Condition before release ${index + 1}`}
                  value={line.conditionBeforeRelease}
                  onChange={(e) =>
                    change(index, { conditionBeforeRelease: e.target.value })
                  }
                >
                  {["NEW", "GOOD", "FAIR"].map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </Select>
                <label className="field">
                  <span>Item remarks {index + 1}</span>
                  <input
                    maxLength={2000}
                    value={line.remarks}
                    onChange={(e) => change(index, { remarks: e.target.value })}
                  />
                </label>
              </div>
              <div className="borrow-line-footer">
                <span className="hint">
                  {item
                    ? `${item.availableQuantity} available · ${item.quantity} total`
                    : "Select an item to view available stock"}
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || lines.length === 1}
                  onClick={() =>
                    setLines((rows) => rows.filter((r) => r.key !== line.key))
                  }
                >
                  Remove item {index + 1}
                </button>
              </div>
            </div>
          );
        })}
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button disabled={busy || !options.items.length}>
            {busy ? "Recording…" : "Record borrowing"}
          </button>
        </div>
      </section>
    </form>
  );
}
