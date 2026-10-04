"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { api, formData } from "./ui";
import { BrandLogo } from "./brand-logo";
export function Login() {
  const router = useRouter();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = formData(e.currentTarget);
    try {
      await api("auth/login", "POST", {
        ...data,
        remember: data.remember === "on",
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <BrandLogo />
          <div>
            <strong>HM LABORATORY</strong>
            <small>Inventory Management</small>
          </div>
        </div>
        <div>
          <span className="eyebrow">A BETTER ORGANIZED LABORATORY</span>
          <h1>
            Every item.
            <br />
            Accounted for.
          </h1>
          <p>
            A clear view of your laboratory’s equipment, supplies, and daily
            stock movements.
          </p>
          <div className="login-stat">
            <ShieldCheck />
            <span>One administrator. A complete audit trail.</span>
          </div>
        </div>
        <small>Hospitality Management · Laboratory Operations</small>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <BrandLogo className="login-logo" />
          <span className="eyebrow">ADMINISTRATOR ACCESS</span>
          <h2>Welcome back</h2>
          <p>Sign in to manage your laboratory inventory.</p>
          <label className="field">
            <span>Username</span>
            <input
              name="username"
              required
              autoComplete="username"
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="password-input">
              <input
                name="password"
                type={show ? "text" : "password"}
                required
                maxLength={128}
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label className="check">
            <input name="remember" type="checkbox" />
            Remember me for 30 days
          </label>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          <button disabled={busy} className="login-submit">
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                Sign in <ArrowRight size={18} />
              </>
            )}
          </button>
          <small className="login-note">
            Authorized administrator access only
          </small>
        </form>
      </section>
    </div>
  );
}
