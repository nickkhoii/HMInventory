"use client";
import { useRef, useState } from "react";
import { returnSchema } from "@/lib/borrow-validation";
import { returnConditions } from "@/lib/borrow-rules";
import { api, Field, Select, formData, label, today } from "./ui";
import type { BorrowRecord } from "./types";
type Line = {
  key: number;
  borrowTransactionItemId: string;
  quantity: string;
  returnCondition: string;
  damageDescription: string;
  actionRequired: string;
  remarks: string;
};
export function ReturnForm({
  record,
  onSave,
}: {
  record: BorrowRecord;
  onSave: () => void;
}) {
  const pending = record.items.filter((i) => i.quantityOutstanding > 0);
  const key = useRef(pending.length),
    requestId = useRef<string | null>(null);
  const blank = (id: string, index: number): Line => ({
    key: index,
    borrowTransactionItemId: id,
    quantity: "0",
    returnCondition: "GOOD",
    damageDescription: "",
    actionRequired: "",
    remarks: "",
  });
  const [lines, setLines] = useState<Line[]>(
      pending.map((i, index) => blank(i.id, index)),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function change(index: number, patch: Partial<Line>) {
    setLines((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const selected = lines.filter(
        (l) => l.quantity.trim() !== "" && Number(l.quantity) !== 0,
      );
      const parsed = returnSchema.safeParse({
        ...formData(e.currentTarget),
        borrowTransactionId: record.id,
        requestId:
          requestId.current ?? (requestId.current = crypto.randomUUID()),
        items: selected.map(({ key: _key, ...line }) => {
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
      await api("returns", "POST", parsed.data);
      onSave();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>Record a return or loss</h2>
            <p>
              Enter quantities for this return. Leave zero for items still on
              loan. Add a line to split one item across conditions.
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={busy || lines.length >= 100}
            onClick={() =>
              setLines((rows) => [...rows, blank(pending[0].id, key.current++)])
            }
          >
            Add return line
          </button>
        </div>
        <div className="form-grid">
          <Field
            name="returnDate"
            title="Return date"
            type="date"
            required
            defaultValue={today()}
          />
          <Field name="remarks" title="Return transaction remarks" />
        </div>
        {lines.map((line, index) => {
          const borrowed = pending.find(
            (i) => i.id === line.borrowTransactionItemId,
          )!;
          return (
            <div className="borrow-line" key={line.key}>
              <div className="form-grid">
                <Select
                  name={`return-item-${index}`}
                  title={`Returned item ${index + 1}`}
                  value={line.borrowTransactionItemId}
                  onChange={(e) =>
                    change(index, { borrowTransactionItemId: e.target.value })
                  }
                >
                  {pending.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.inventoryCode} · {i.itemName} ({i.quantityOutstanding}{" "}
                      outstanding)
                    </option>
                  ))}
                </Select>
                <label className="field">
                  <span>Quantity being returned {index + 1}</span>
                  <input
                    type="number"
                    min={0}
                    max={borrowed.quantityOutstanding}
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      change(index, { quantity: e.target.value })
                    }
                  />
                </label>
                <Select
                  name={`return-condition-${index}`}
                  title={`Condition upon return ${index + 1}`}
                  value={line.returnCondition}
                  onChange={(e) =>
                    change(index, { returnCondition: e.target.value })
                  }
                >
                  {returnConditions.map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </Select>
                <label className="field">
                  <span>Return item remarks {index + 1}</span>
                  <input
                    maxLength={2000}
                    value={line.remarks}
                    onChange={(e) => change(index, { remarks: e.target.value })}
                  />
                </label>
                {["DAMAGED", "LOST_MISSING"].includes(line.returnCondition) && (
                  <>
                    <label className="field">
                      <span>Damage / loss description {index + 1}</span>
                      <input
                        required={Number(line.quantity) > 0}
                        maxLength={2000}
                        value={line.damageDescription}
                        onChange={(e) =>
                          change(index, { damageDescription: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Action required {index + 1}</span>
                      <input
                        maxLength={2000}
                        value={line.actionRequired}
                        onChange={(e) =>
                          change(index, { actionRequired: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="borrow-line-footer">
                <span className="hint">
                  {borrowed.quantityOutstanding} {borrowed.unit} outstanding ·
                  Damaged/lost units will not enter available stock.
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || lines.length === 1}
                  onClick={() =>
                    setLines((rows) => rows.filter((r) => r.key !== line.key))
                  }
                >
                  Remove return line {index + 1}
                </button>
              </div>
            </div>
          );
        })}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button disabled={busy}>
            {busy ? "Recording…" : "Record return"}
          </button>
        </div>
      </section>
    </form>
  );
}
