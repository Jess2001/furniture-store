import { useState, type FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/api";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

const inputClass =
  "w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant font-body-sm text-body-sm text-on-surface focus:border-primary outline-none";
const labelClass =
  "block font-label-caps text-label-caps uppercase text-secondary mb-1";

export function AuthModal() {
  const { authOpen, closeAuth, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else
        await register({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        });
      setPassword("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={authOpen} onClose={closeAuth} labelledBy="auth-title">
      <div className="p-space-lg">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">
              Your account
            </span>
            <h2
              id="auth-title"
              className="font-headline-md text-headline-md text-on-surface mt-1"
            >
              {mode === "login" ? "Sign in" : "Create an account"}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            aria-label="Close"
            className="text-secondary hover:text-on-surface"
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-space-md space-y-space-sm">
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-space-sm">
              <div>
                <label htmlFor="first_name" className={labelClass}>
                  First name
                </label>
                <input
                  id="first_name"
                  className={inputClass}
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="last_name" className={labelClass}>
                  Last name
                </label>
                <input
                  id="last_name"
                  className={inputClass}
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className={inputClass}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="bg-error-container text-on-error-container px-3 py-2 font-body-sm text-body-sm"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-12 bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-space-md font-body-sm text-body-sm text-secondary text-center">
          {mode === "login"
            ? "New to LUXURY Living?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-primary font-semibold hover:underline"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </Modal>
  );
}
