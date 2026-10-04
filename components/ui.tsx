"use client";
import { useEffect, useRef, useId } from "react";
import { X, LoaderCircle, PackageOpen } from "lucide-react";
export { api } from "@/lib/client-api";
export const label = (v: string) =>
  v
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const money = (v: number | string) => {
  const value = typeof v === "number" ? v.toFixed(2) : v;
  const [whole, fraction = ""] = value.split(".");
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })
    .formatToParts(BigInt(whole))
    .map((part) =>
      part.type === "fraction"
        ? fraction.padEnd(2, "0").slice(0, 2)
        : part.value,
    )
    .join("");
};
export const date = (v: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
  }).format(new Date(v));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function Badge({ value }: { value: string }) {
  return <span className={`badge ${value.toLowerCase()}`}>{label(value)}</span>;
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      <p>Loading laboratory records…</p>
    </div>
  );
}
export function Empty({ text = "No records found" }: { text?: string }) {
  return (
    <div className="empty">
      <PackageOpen size={36} />
      <p>{text}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      aria-labelledby={titleId}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  name,
  title,
  type = "text",
  required = false,
  value,
  defaultValue,
  min,
  max,
  step,
  disabled = false,
}: {
  name: string;
  title: string;
  type?: string;
  required?: boolean;
  value?: string | number;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {title}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        value={value}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        maxLength={type === "text" ? 2000 : undefined}
      />
    </label>
  );
}
export function Select({
  name,
  title,
  children,
  defaultValue = "",
  required = false,
  onChange,
  value,
}: {
  name: string;
  title: string;
  children: React.ReactNode;
  defaultValue?: string;
  required?: boolean;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  value?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {title}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        {...(value !== undefined ? { value } : { defaultValue })}
        onChange={onChange}
      >
        {children}
      </select>
    </div>
  );
}
export function Pagination({
  page,
  total,
  size = 20,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pagination">
      <span>
        {total} records · Page {page} of {pages}
      </span>
      <div>
        <button
          className="secondary"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function formData(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}
