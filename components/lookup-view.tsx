"use client";
import { useState } from "react";
import { Plus, Pencil, Archive, RotateCcw, Tags, MapPin } from "lucide-react";
import { api, Empty, Field, formData, Modal, Badge } from "./ui";
import type { Lookup } from "./types";
export function LookupView({
  resource,
  data,
  refresh,
  notify,
}: {
  resource: string;
  data: Lookup[];
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [editing, setEditing] = useState<Lookup | null | undefined>(),
    [confirm, setConfirm] = useState<Lookup>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [archived, setArchived] = useState(false);
  const title = resource === "categories" ? "Categories" : "Locations";
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        editing ? `${resource}/${editing.id}` : resource,
        editing ? "PATCH" : "POST",
        formData(e.currentTarget),
      );
      setEditing(undefined);
      refresh();
      notify(`${title} updated`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change() {
    if (!confirm) return;
    setBusy(true);
    try {
      await api(`${resource}/${confirm.id}`, "PATCH", {
        action: confirm.isActive ? "archive" : "restore",
      });
      setConfirm(undefined);
      refresh();
      notify("Record status updated");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = data.filter((i) => i.isActive !== archived);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LABORATORY ORGANIZATION</span>
          <h1>{title}</h1>
          <p>
            {resource === "categories"
              ? "Group your inventory into meaningful categories."
              : "Define where your laboratory inventory is kept."}
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setEditing(null);
          }}
        >
          <Plus size={17} />
          Add {resource === "categories" ? "category" : "location"}
        </button>
      </div>
      <div className="tab-bar">
        <button
          className={!archived ? "selected" : ""}
          onClick={() => setArchived(false)}
        >
          Active ({data.filter((i) => i.isActive).length})
        </button>
        <button
          className={archived ? "selected" : ""}
          onClick={() => setArchived(true)}
        >
          Archived ({data.filter((i) => !i.isActive).length})
        </button>
      </div>
      {filtered.length ? (
        <div className="lookup-grid">
          {filtered.map((i) => (
            <section className="panel lookup-card" key={i.id}>
              <div className="lookup-icon">
                {resource === "categories" ? <Tags /> : <MapPin />}
              </div>
              <h2>{i.name}</h2>
              <p>{i.description || "No description added"}</p>
              <div>
                <Badge value={i.isActive ? "ACTIVE" : "ARCHIVED"} />
                <span>{i._count?.items ?? 0} inventory items</span>
              </div>
              <div className="form-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setError("");
                    setEditing(i);
                  }}
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setError("");
                    setConfirm(i);
                  }}
                >
                  {i.isActive ? <Archive size={15} /> : <RotateCcw size={15} />}{" "}
                  {i.isActive ? "Archive" : "Restore"}
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty text={`No ${archived ? "archived" : "active"} ${resource}`} />
        </section>
      )}
      {editing !== undefined && (
        <Modal
          title={`${editing ? "Edit" : "Add"} ${resource === "categories" ? "category" : "location"}`}
          onClose={() => setEditing(undefined)}
        >
          <form onSubmit={save}>
            <Field
              name="name"
              title="Name"
              required
              defaultValue={editing?.name}
            />
            <label className="field">
              <span>Description</span>
              <textarea
                name="description"
                maxLength={2000}
                defaultValue={editing?.description}
              />
            </label>
            {error && (
              <p className="alert error" role="alert">
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
              <button disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={`${confirm.isActive ? "Archive" : "Restore"} ${confirm.name}`}
          onClose={() => setConfirm(undefined)}
        >
          <p>
            Existing inventory references and audit history will remain
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
            <button disabled={busy} onClick={change}>
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
