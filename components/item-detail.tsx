"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { api, Badge, Loading, Modal, date, money, Empty, label } from "./ui";
import { ItemForm } from "./item-form";
import type { Item, Options, Transaction } from "./types";
type Detail = Item & {
  damages: { quantity: number; status: string }[];
  losses: { quantity: number; status: string }[];
  disposals: { quantity: number }[];
  transactions: Transaction[];
  conditions: {
    id: string;
    previous: string | null;
    current: string;
    reason: string;
    createdAt: string;
  }[];
};
export function ItemDetail({ id }: { id: string }) {
  const [item, setItem] = useState<Detail>(),
    [options, setOptions] = useState<Options>(),
    [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [i, o] = await Promise.all([
        api<Detail>(`inventory/${id}`),
        api<Options>("options"),
      ]);
      setItem(i);
      setOptions(o);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (error)
    return (
      <p className="alert error" role="alert">
        {error}
      </p>
    );
  if (!item) return <Loading />;
  const fields = {
    "Damaged quantity": String(
      item.damages
        .filter((i) => !["REPAIRED", "DISPOSED"].includes(i.status))
        .reduce((n, i) => n + i.quantity, 0),
    ),
    "Lost / Missing quantity": String(
      item.losses
        .filter((i) => i.status !== "RECOVERED")
        .reduce((n, i) => n + i.quantity, 0),
    ),
    "Disposed quantity (historical)": String(
      item.disposals.reduce((n, i) => n + i.quantity, 0),
    ),
    "Borrowed quantity": String(item.borrowedQuantity),
    Category: item.category.name,
    Location: item.location.name,
    Brand: item.brand,
    Model: item.model,
    "Serial number": item.serialNumber,
    Unit: item.unit,
    Quantity: item.quantity,
    "Available quantity": item.availableQuantity,
    "Minimum stock": item.minimumStock,
    "Unit cost": money(item.unitCost),
    "Total value": money(item.totalValue),
    "Date acquired": date(item.dateAcquired),
    Supplier: item.supplier,
    Status: item.isActive ? "Active" : "Archived",
    Created: date(item.createdAt),
    Updated: date(item.updatedAt),
  };
  return (
    <>
      <Link className="text-link back-link" href="/inventory">
        <ArrowLeft size={16} />
        Back to inventory
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{item.inventoryCode}</span>
          <h1>{item.name}</h1>
          <p>{item.description || "Laboratory inventory item"}</p>
        </div>
        <div className="row-actions">
          {!item.isActive && (
            <button
              onClick={async () => {
                try {
                  await api(`inventory/${item.id}`, "PATCH", {
                    action: "restore",
                  });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Restore inventory
            </button>
          )}
          <button onClick={() => setEditing(true)}>
            <Pencil size={16} />
            Edit item
          </button>
        </div>
      </div>
      <section className="panel detail-panel">
        <Badge value={item.condition} />
        <dl className="detail-grid">
          {Object.entries(fields).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <h3>Notes</h3>
        <p>{item.notes || "No notes added"}</p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Inventory history</h2>
            <p>Every stock movement, with total and available balances</p>
          </div>
        </div>
        {item.transactions.length ? (
          <div className="timeline">
            {item.transactions.map((t) => (
              <div key={t.id}>
                <span className="timeline-dot" />
                <div>
                  <small>{date(t.transactionDate)}</small>
                  <h3>
                    {label(t.type)} · {t.quantity} units
                  </h3>
                  <p>
                    Total: {t.previousQuantity} → {t.newQuantity} &nbsp;
                    Available: {t.previousAvailable} → {t.newAvailable}
                  </p>
                  <small>
                    {t.reason} {t.remarks}
                  </small>
                  <small>{t.transactionNumber}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Condition history</h2>
        </div>
        <div className="timeline">
          {item.conditions.map((c) => (
            <div key={c.id}>
              <span className="timeline-dot" />
              <div>
                <small>{date(c.createdAt)}</small>
                <h3>
                  {c.previous ? `${label(c.previous)} → ` : ""}
                  {label(c.current)}
                </h3>
                <p>{c.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {editing && options && (
        <Modal title="Edit inventory item" onClose={() => setEditing(false)}>
          <ItemForm
            item={item}
            options={options}
            onCancel={() => setEditing(false)}
            onSave={() => {
              setEditing(false);
              void load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
