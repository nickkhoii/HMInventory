"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, Pencil, Archive, RotateCcw, Plus } from "lucide-react";
import { conditions } from "@/lib/validation";
import {
  api,
  Badge,
  Empty,
  Modal,
  Pagination,
  Select,
  label,
  money,
} from "./ui";
import { ItemForm } from "./item-form";
import type { Item, Options } from "./types";
export type InventoryPage = { items: Item[]; total: number; page: number };
export function InventoryView({
  data,
  options,
  params,
  setParams,
  refresh,
  notify,
}: {
  data: InventoryPage;
  options: Options;
  params: URLSearchParams;
  setParams: (p: URLSearchParams) => void;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [editing, setEditing] = useState<Item | null | undefined>(),
    [confirm, setConfirm] = useState<Item>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  async function archive() {
    if (!confirm) return;
    setBusy(true);
    try {
      await api(`inventory/${confirm.id}`, "PATCH", {
        action: confirm.isActive ? "archive" : "restore",
      });
      setConfirm(undefined);
      refresh();
      notify("Inventory status updated");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR LABORATORY ASSETS</span>
          <h1>Inventory</h1>
          <p>Keep equipment, tools, and supplies organized in one place.</p>
        </div>
        <button onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add inventory item
        </button>
      </div>
      <section className="panel">
        <div className="inventory-toolbar">
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              filter(
                "search",
                String(new FormData(e.currentTarget).get("search") || ""),
              );
            }}
          >
            <Search size={17} />
            <input
              name="search"
              aria-label="Search inventory"
              placeholder="Search code, item, brand, serial, supplier…"
              defaultValue={params.get("search") ?? ""}
            />
            <button className="secondary">Search</button>
          </form>
          <label className="check">
            <input
              type="checkbox"
              checked={params.get("archived") === "true"}
              onChange={(e) =>
                filter("archived", e.target.checked ? "true" : "")
              }
            />
            Archived items
          </label>
        </div>
        <div className="filters">
          <Select
            name="category"
            title="Category"
            value={params.get("category") ?? ""}
            onChange={(e) => filter("category", e.target.value)}
          >
            <option value="">All categories</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            name="location"
            title="Location"
            value={params.get("location") ?? ""}
            onChange={(e) => filter("location", e.target.value)}
          >
            <option value="">All locations</option>
            {options.locations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            name="condition"
            title="Condition"
            value={params.get("condition") ?? ""}
            onChange={(e) => filter("condition", e.target.value)}
          >
            <option value="">All conditions</option>
            {conditions.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </Select>
          <Select
            name="stock"
            title="Stock level"
            value={params.get("stock") ?? ""}
            onChange={(e) => filter("stock", e.target.value)}
          >
            <option value="">All stock levels</option>
            {["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK", "ATTENTION"].map(
              (c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ),
            )}
          </Select>
          <Select
            name="sort"
            title="Sort by"
            value={params.get("sort") ?? "updatedAt"}
            onChange={(e) => filter("sort", e.target.value)}
          >
            {[
              "updatedAt",
              "name",
              "quantity",
              "dateAcquired",
              "unitCost",
              "totalValue",
            ].map((c) => (
              <option key={c} value={c}>
                {
                  (
                    {
                      updatedAt: "Recently updated",
                      name: "Item name",
                      quantity: "Quantity",
                      dateAcquired: "Date acquired",
                      unitCost: "Unit cost",
                      totalValue: "Total value",
                    } as Record<string, string>
                  )[c]
                }
              </option>
            ))}
          </Select>
        </div>
        {data.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Inventory item</th>
                  <th>Category / location</th>
                  <th>Quantity</th>
                  <th>Available</th>
                  <th>Condition / stock</th>
                  <th>Total value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link className="item-link" href={`/inventory/${i.id}`}>
                        <strong>{i.name}</strong>
                        <small>{i.inventoryCode}</small>
                      </Link>
                    </td>
                    <td>
                      {i.category.name}
                      <small>{i.location.name}</small>
                    </td>
                    <td>
                      {i.quantity}
                      <small>{i.unit}</small>
                    </td>
                    <td>
                      {i.availableQuantity}
                      <small>Min. {i.minimumStock}</small>
                      <small>Borrowed: {i.borrowedQuantity}</small>
                    </td>
                    <td>
                      <Badge value={i.condition} />
                      <small>
                        <Badge
                          value={
                            !i.isActive
                              ? "ARCHIVED"
                              : i.availableQuantity === 0
                                ? "OUT_OF_STOCK"
                                : i.availableQuantity <= i.minimumStock
                                  ? "LOW_STOCK"
                                  : "AVAILABLE"
                          }
                        />
                      </small>
                    </td>
                    <td>{money(i.totalValue)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label={`Edit ${i.name}`}
                          className="icon-button"
                          onClick={() => setEditing(i)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`${i.isActive ? "Archive" : "Restore"} ${i.name}`}
                          className="icon-button"
                          onClick={() => {
                            setError("");
                            setConfirm(i);
                          }}
                        >
                          {i.isActive ? (
                            <Archive size={16} />
                          ) : (
                            <RotateCcw size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No inventory matches your filters" />
        )}
        <Pagination
          page={data.page}
          total={data.total}
          onChange={(n) => {
            const p = new URLSearchParams(params);
            p.set("page", String(n));
            setParams(p);
          }}
        />
      </section>
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit inventory item" : "Add inventory item"}
          onClose={() => setEditing(undefined)}
        >
          <ItemForm
            item={editing ?? undefined}
            options={options}
            onCancel={() => setEditing(undefined)}
            onSave={() => {
              setEditing(undefined);
              refresh();
              notify("Inventory item saved");
            }}
          />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={`${confirm.isActive ? "Archive" : "Restore"} inventory item`}
          onClose={() => setConfirm(undefined)}
        >
          <p>
            {confirm.isActive ? "Archive" : "Restore"}{" "}
            <strong>{confirm.name}</strong>? Historical records remain
            available.
          </p>
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="secondary" onClick={() => setConfirm(undefined)}>
              Cancel
            </button>
            <button disabled={busy} onClick={archive}>
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
