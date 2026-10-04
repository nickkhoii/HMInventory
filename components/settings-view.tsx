"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Field, formData } from "./ui";
export type SettingsData = {
  name: string;
  username: string;
  institutionName: string;
  laboratoryName: string;
  reportHeader: string;
};
export function SettingsView({
  data,
  notify,
}: {
  data: SettingsData;
  notify: (s: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    try {
      await api("settings", "PATCH", formData(form));
      form
        .querySelectorAll<HTMLInputElement>("input[type=password]")
        .forEach((i) => (i.value = ""));
      notify(
        "Settings saved. Other sessions were revoked if the password changed.",
      );
      router.refresh();
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
          <span className="eyebrow">ADMINISTRATOR & LABORATORY</span>
          <h1>Settings</h1>
          <p>Manage the single administrator account and report details.</p>
        </div>
      </div>
      <section className="panel form-panel">
        <form onSubmit={save}>
          <h2>Administrator profile</h2>
          <div className="form-grid">
            <Field
              name="name"
              title="Administrator name"
              required
              defaultValue={data.name}
            />
            <Field
              name="username"
              title="Username"
              required
              defaultValue={data.username}
            />
          </div>
          <h2>Laboratory information</h2>
          <div className="form-grid">
            <Field
              name="institutionName"
              title="Institution name"
              required
              defaultValue={data.institutionName}
            />
            <Field
              name="laboratoryName"
              title="Laboratory name"
              required
              defaultValue={data.laboratoryName}
            />
            <div className="full">
              <Field
                name="reportHeader"
                title="Report header"
                required
                defaultValue={data.reportHeader}
              />
            </div>
          </div>
          <h2>Confirm changes</h2>
          <div className="form-grid">
            <Field
              name="currentPassword"
              title="Current password"
              type="password"
              required
            />
            <Field
              name="newPassword"
              title="New password (optional; at least 12 characters)"
              type="password"
            />
          </div>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button disabled={busy}>
              {busy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
