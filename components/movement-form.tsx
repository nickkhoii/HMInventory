"use client";
import { useRef, useState } from "react";
import { operationSchema } from "@/lib/validation";
import { api, Field, Select, formData, label, today } from "./ui";
import type { Options, Incident } from "./types";
const adjustmentTypes = [
  "ADD",
  "DEDUCT",
  "PHYSICAL_COUNT",
  "DAMAGE",
  "LOST",
  "RECOVERY",
  "DISPOSAL",
  "RETURNED",
  "OTHER",
];
export function MovementForm({
  type,
  options,
  record,
  onSave,
  onCancel,
}: {
  type: string;
  options: Options;
  record?: Incident;
  onSave: () => void;
  onCancel?: () => void;
}) {
  const requestId = useRef<string | null>(null);
  const [selected, setSelected] = useState(record?.itemId ?? ""),
    [operation, setOperation] = useState(type === "ADJUSTMENT" ? "ADD" : type),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [losses, setLosses] = useState<Incident[]>([]),
    [lossId, setLossId] = useState("");
  const effectiveRecord =
    record ??
    (operation === "RECOVERY"
      ? losses.find((r) => r.id === lossId && r.itemId === selected)
      : undefined);
  async function changeOperation(next: string) {
    setOperation(next);
    setLossId("");
    setError("");
    if (next === "RECOVERY")
      try {
        setLosses(
          (await api<Incident[]>("lost")).filter(
            (r) => r.status !== "RECOVERED",
          ),
        );
      } catch (e) {
        setError((e as Error).message);
      }
  }
  const item = options.items.find((i) => i.id === selected);
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = {
        requestId:
          requestId.current ?? (requestId.current = crypto.randomUUID()),
        ...formData(e.currentTarget),
        itemId: effectiveRecord?.itemId ?? selected,
        type: operation,
        quantity:
          effectiveRecord?.quantity ??
          Number(new FormData(e.currentTarget).get("quantity")),
        recordId: effectiveRecord?.id,
      };
      const parsed = operationSchema.safeParse(data);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
      await api("movements", "POST", parsed.data);
      requestId.current = null;
      onSave();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        {type === "ADJUSTMENT" && (
          <Select
            name="type"
            title="Adjustment type"
            value={operation}
            onChange={(e) => void changeOperation(e.target.value)}
          >
            {adjustmentTypes.map((t) => (
              <option key={t} value={t}>
                {t === "PHYSICAL_COUNT"
                  ? "Physical count correction"
                  : t === "OTHER"
                    ? "Other (add quantity)"
                    : t === "RECOVERY"
                      ? "Found / recovered"
                      : label(t)}
              </option>
            ))}
          </Select>
        )}
        <Select
          name="itemId"
          title="Inventory item"
          required
          value={selected}
          onChange={(e) => {
            if (!record) {
              setSelected(e.target.value);
              setLossId("");
            }
          }}
        >
          <option value="">Select an item</option>
          {options.items
            .filter((i) => !record || i.id === record.itemId)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.inventoryCode} · {i.name}
              </option>
            ))}
        </Select>
        {operation === "RECOVERY" && !record && (
          <Select
            name="recordId"
            title="Missing record to recover"
            required
            value={lossId}
            onChange={(e) => setLossId(e.target.value)}
          >
            <option value="">Select an unresolved record</option>
            {losses
              .filter((r) => r.itemId === selected)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.quantity} units · {r.description}
                </option>
              ))}
          </Select>
        )}
        <Field
          name="date"
          title="Transaction date"
          type="date"
          required
          defaultValue={today()}
        />
        <Field
          key={effectiveRecord?.id ?? operation}
          name="quantity"
          title={
            operation === "PHYSICAL_COUNT"
              ? "Counted available quantity"
              : "Quantity"
          }
          type="number"
          min={operation === "PHYSICAL_COUNT" ? 0 : 1}
          required
          defaultValue={effectiveRecord?.quantity ?? 1}
          disabled={!!effectiveRecord}
        />
        {item && (
          <div className="balance-preview full">
            <span>
              Total held <strong>{item.quantity}</strong>
            </span>
            <span>
              Available <strong>{item.availableQuantity}</strong>
            </span>
            <span>
              Unavailable{" "}
              <strong>{item.quantity - item.availableQuantity}</strong>
            </span>
          </div>
        )}
        {operation === "STOCK_IN" && (
          <>
            <Field
              name="unitCost"
              title="Unit cost (PHP)"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={0}
            />
            <Field name="supplier" title="Supplier" />
            <Field name="referenceNumber" title="Reference number" />
          </>
        )}
        {operation === "STOCK_OUT" && (
          <Field name="purpose" title="Purpose" required />
        )}
        {operation === "DISPOSAL" && (
          <Field name="method" title="Disposal method" required />
        )}
        <label className="field full">
          <span>
            Reason / description
            {!["STOCK_IN", "STOCK_OUT"].includes(operation) ? " *" : ""}
          </span>
          <textarea
            name="reason"
            maxLength={2000}
            required={!["STOCK_IN", "STOCK_OUT"].includes(operation)}
          />
        </label>
        <label className="field full">
          <span>Remarks</span>
          <textarea name="remarks" maxLength={2000} />
        </label>
      </div>
      {operation === "PHYSICAL_COUNT" && (
        <p className="hint">
          The physical count updates available stock. Existing damaged and
          missing quantities remain tracked.
        </p>
      )}
      {effectiveRecord && (
        <p className="hint">
          This resolves the full record of {effectiveRecord.quantity} units. The
          record remains in the audit history.
        </p>
      )}
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button disabled={busy}>
          {busy ? "Recording…" : `Record ${label(operation)}`}
        </button>
      </div>
    </form>
  );
}
