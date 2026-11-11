import { useState, type FormEvent } from "react";
import { api, ApiError, setApiKey } from "../api";
import { useApp } from "../store";

export function Setup() {
  const setKey = useApp((s) => s.setKey);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect(e: FormEvent) {
    e.preventDefault();
    const k = value.trim();
    if (!k) {
      setError("Enter your key to connect.");
      return;
    }
    setBusy(true);
    setError(null);
    setApiKey(k);
    try {
      await api.health();
      setKey(k);
    } catch (err) {
      setApiKey("");
      setError(
        err instanceof ApiError && err.status === 401
          ? "That key didn't work. Check it and try again."
          : err instanceof Error ? err.message : "Couldn't connect. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup">
      <div>
        <h1 className="wordmark">
          Swipe<em>file</em>
        </h1>
        <p className="lede">Your saves from Instagram and X, in one place you'll actually come back to.</p>
      </div>
      <form className="field" onSubmit={connect} noValidate>
        <label htmlFor="key">Key</label>
        <input
          id="key"
          className="input"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="key-help"
        />
        {error ? (
          <p id="key-help" className="error" role="alert">{error}</p>
        ) : (
          <p id="key-help" className="hint">It's in SETUP.local.md on your Mac. Opening the setup link there fills it in for you.</p>
        )}
        <button className="btn btn-primary btn-wide" type="submit" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? <span className="spinner" aria-label="Connecting" /> : "Connect"}
        </button>
      </form>
    </div>
  );
}
