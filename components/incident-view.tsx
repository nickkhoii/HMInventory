"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { MovementForm } from "./movement-form";
import {
  api,
  Badge,
  Empty,
  Field,
  Modal,
  Select,
  date,
  formData,
  label,
} from "./ui";
import type { Incident, Options } from "./types";
export function IncidentView({
  resource,
  data,
  options,
  refresh,
  notify,
}: {
  resource: string;
  data: Incident[];
  options: Options;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [operation, setOperation] = useState<{
      type: string;
      record?: Incident;
    }>(),
    [editing, setEditing] = useState<Incident>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const title =
    resource === "damaged"
      ? "Damaged Items"
      : resource === "lost"
        ? "Lost / Missing Items"
        : "Disposal Records";
  const type =
    resource === "damaged"
      ? "DAMAGE"
      : resource === "lost"
        ? "LOST"
        : "DISPOSAL";
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setBusy(true);
    try {
      await api(
        `${resource}/${editing.id}`,
        "PATCH",
        formData(e.currentTarget),
      );
      setEditing(undefined);
      refresh();
      notify("Record updated");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = data.filter((r) => !status || r.status === status);
  const states =
    resource === "damaged"
      ? [
          "FOR_ASSESSMENT",
          "FOR_REPAIR",
          "REPAIRED",
          "BEYOND_REPAIR",
          "DISPOSED",
        ]
      : ["MISSING", "UNDER_INVESTIGATION", "RECOVERED", "DECLARED_LOST"];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ASSET CARE & ACCOUNTABILITY</span>
          <h1>{title}</h1>
          <p>Track each record and preserve its complete history.</p>
        </div>
        <button onClick={() => setOperation({ type })}>
          <Plus size={17} />
          Record {label(type)}
        </button>
      </div>
      <section className="panel">
        {resource !== "disposal" && (
          <div className="filters">
            <Select
              name="status"
              title="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </Select>
          </div>
        )}
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Inventory item</th>
                  <th>Quantity</th>
                  <th>Date reported</th>
                  <th>Description / reason</th>
                  <th>{resource === "disposal" ? "Method" : "Status"}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/inventory/${r.itemId}`}>
                        <strong>{r.item.name}</strong>
                        <small>{r.item.inventoryCode}</small>
                      </Link>
                      {resource === "damaged" && (
                        <small>{r.item.category.name}</small>
                      )}
                      {r.returnItem && (
                        <small>
                          <Link
                            href={`/borrowing/${r.returnItem.returnTransaction.borrowTransaction.id}`}
                          >
                            {
                              r.returnItem.returnTransaction.borrowTransaction
                                .transactionNumber
                            }{" "}
                            ·{" "}
                            {
                              r.returnItem.returnTransaction.borrowTransaction
                                .borrowerName
                            }
                          </Link>
                        </small>
                      )}
                    </td>
                    <td>{r.quantity}</td>
                    <td>{date(r.dateReported ?? r.disposalDate)}</td>
                    <td>
                      {r.description ?? r.reason}
                      <small>{r.actionTaken ?? r.remarks}</small>
                    </td>
                    <td>
                      {resource === "disposal" ? (
                        r.method
                      ) : (
                        <Badge value={r.status} />
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {resource === "damaged" &&
                          r.item.isActive &&
                          !["REPAIRED", "DISPOSED"].includes(r.status) && (
                            <>
                              <button
                                className="secondary"
                                onClick={() => {
                                  setError("");
                                  setEditing(r);
                                }}
                              >
                                Update
                              </button>
                              {r.status !== "BEYOND_REPAIR" && (
                                <button
                                  className="secondary"
                                  onClick={() =>
                                    setOperation({ type: "REPAIR", record: r })
                                  }
                                >
                                  Repair
                                </button>
                              )}
                              <button
                                className="secondary"
                                onClick={() =>
                                  setOperation({ type: "DISPOSAL", record: r })
                                }
                              >
                                Dispose
                              </button>
                            </>
                          )}
                        {resource === "lost" &&
                          r.item.isActive &&
                          r.status !== "RECOVERED" && (
                            <>
                              <button
                                className="secondary"
                                onClick={() => {
                                  setError("");
                                  setEditing(r);
                                }}
                              >
                                Update
                              </button>
                              <button
                                className="secondary"
                                onClick={() =>
                                  setOperation({ type: "RECOVERY", record: r })
                                }
                              >
                                Recover
                              </button>
                            </>
                          )}
                        {!r.item.isActive && resource !== "disposal" && (
                          <Link
                            className="text-link"
                            href={`/inventory/${r.itemId}`}
                          >
                            Restore inventory to resolve this record
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No records match this view" />
        )}
      </section>
      {operation && (
        <Modal
          title={`Record ${label(operation.type)}`}
          onClose={() => setOperation(undefined)}
        >
          <MovementForm
            type={operation.type}
            options={options}
            record={operation.record}
            onCancel={() => setOperation(undefined)}
            onSave={() => {
              setOperation(undefined);
              refresh();
              notify("Inventory movement recorded");
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal
          title="Update record status"
          onClose={() => setEditing(undefined)}
        >
          <form onSubmit={save}>
            <Select name="status" title="Status" defaultValue={editing.status}>
              {(resource === "damaged"
                ? ["FOR_ASSESSMENT", "FOR_REPAIR", "BEYOND_REPAIR"]
                : ["MISSING", "UNDER_INVESTIGATION", "DECLARED_LOST"]
              ).map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </Select>
            <Field
              name={resource === "damaged" ? "actionTaken" : "remarks"}
              title={resource === "damaged" ? "Action taken" : "Remarks"}
              defaultValue={editing.actionTaken ?? editing.remarks}
            />
            {error && (
              <p role="alert" className="alert error">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </button>
              <button disabled={busy}>Save status</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
