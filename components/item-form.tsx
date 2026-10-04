"use client";
import { useState } from "react";
import { conditions, itemSchema } from "@/lib/validation";
import { api, Field, Select, formData, label } from "./ui";
import type { Item, Options } from "./types";
import { today } from "./ui";
export function ItemForm({
  item,
  options,
  onSave,
  onCancel,
}: {
  item?: Item;
  options: Options;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const raw = {
        ...formData(e.currentTarget),
        expectedUpdatedAt: item?.updatedAt,
        quantity:
          item?.quantity ??
          Number(new FormData(e.currentTarget).get("quantity")),
      };
      const validated = itemSchema.safeParse(raw);
      if (!validated.success)
        throw new Error(
          validated.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
      await api(
        item ? `inventory/${item.id}` : "inventory",
        item ? "PATCH" : "POST",
        validated.data,
      );
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
        <Field
          name="inventoryCode"
          title="Inventory code"
          required
          defaultValue={item?.inventoryCode}
        />
        <Field
          name="name"
          title="Item name"
          required
          defaultValue={item?.name}
        />
        <Select
          name="categoryId"
          title="Category"
          required
          defaultValue={item?.categoryId}
        >
          <option value="">Select category</option>
          {options.categories
            .filter((c) => c.isActive || c.id === item?.categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.isActive ? " (archived)" : ""}
              </option>
            ))}
        </Select>
        <Select
          name="locationId"
          title="Location"
          required
          defaultValue={item?.locationId}
        >
          <option value="">Select location</option>
          {options.locations
            .filter((c) => c.isActive || c.id === item?.locationId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.isActive ? " (archived)" : ""}
              </option>
            ))}
        </Select>
        <Field name="brand" title="Brand" defaultValue={item?.brand} />
        <Field name="model" title="Model" defaultValue={item?.model} />
        <Field
          name="serialNumber"
          title="Serial number"
          defaultValue={item?.serialNumber}
        />
        <Field
          name="unit"
          title="Unit of measurement"
          required
          defaultValue={item?.unit ?? "piece"}
        />
        <Field
          name="quantity"
          title={
            item
              ? "Quantity (use stock operations to change)"
              : "Initial quantity"
          }
          type="number"
          min={0}
          required
          disabled={!!item}
          defaultValue={item?.quantity ?? 0}
        />
        <Field
          name="minimumStock"
          title="Minimum stock level"
          type="number"
          min={0}
          required
          defaultValue={item?.minimumStock ?? 0}
        />
        <Field
          name="unitCost"
          title="Unit cost (PHP)"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={item?.unitCost ?? 0}
        />
        <Field
          name="dateAcquired"
          title="Date acquired"
          type="date"
          required
          defaultValue={item?.dateAcquired.slice(0, 10) ?? today()}
        />
        <Field name="supplier" title="Supplier" defaultValue={item?.supplier} />
        <Select
          name="condition"
          title="Condition"
          required
          defaultValue={item?.condition ?? "GOOD"}
        >
          {conditions
            .filter((c) =>
              item && item.quantity > 0 && item.availableQuantity === 0
                ? c === item.condition
                : ["NEW", "GOOD", "FAIR"].includes(c) || c === item?.condition,
            )
            .map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
        </Select>
        <label className="field full">
          <span>Description</span>
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={item?.description}
          />
        </label>
        <label className="field full">
          <span>Notes</span>
          <textarea name="notes" maxLength={2000} defaultValue={item?.notes} />
        </label>
      </div>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button disabled={busy}>
          {busy ? "Saving…" : "Save inventory item"}
        </button>
      </div>
    </form>
  );
}
