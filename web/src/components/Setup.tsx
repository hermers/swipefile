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
    // Accept the key itself or the whole setup link (…#key=abc).
    const k = value.trim().match(/key=([a-f0-9]{16,})/i)?.[1] ?? value.trim();
    if (!k) {
      setError("Paste your key or setup link to connect.");
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
        <label htmlFor="key">Key or setup link</label>
        <input
          id="key"
          className="input"
          type="text"
          inputMode="url"
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
          <p id="key-help" className="hint">Both are in SETUP.local.md on your Mac. You only need to do this once per device.</p>
        )}
        <button className="btn btn-primary btn-wide" type="submit" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? <span className="spinner" aria-label="Connecting" /> : "Connect"}
        </button>
      </form>
    </div>
  );
}
