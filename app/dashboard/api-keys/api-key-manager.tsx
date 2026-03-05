"use client";

import { FormEvent, useEffect, useState } from "react";

type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

export function ApiKeyManager() {
  const [name, setName] = useState("Codex integration");
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [newKey, setNewKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadKeys() {
    const response = await fetch("/api/v1/apikeys", { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<ApiKeyItem[]>;
    if (payload.success && payload.data) {
      setKeys(payload.data);
    }
  }

  useEffect(() => {
    void loadKeys();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setNewKey("");

    const response = await fetch("/api/v1/apikeys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const payload = (await response.json()) as ApiResponse<{ token: string }>;

    if (!response.ok || !payload.success || !payload.data) {
      setMessage(payload.error?.message ?? "Failed to create API key");
      setBusy(false);
      return;
    }

    setNewKey(payload.data.token);
    setMessage("API key generated. Copy it now, it is shown only once.");
    await loadKeys();
    setBusy(false);
  }

  return (
    <section className="card">
      <h2>API Keys</h2>
      <p>Create and manage Codex API keys directly in the web app.</p>

      <form onSubmit={onCreate}>
        <label htmlFor="keyName">Key name</label>
        <input id="keyName" value={name} onChange={(event) => setName(event.target.value)} required />
        <button type="submit" disabled={busy}>{busy ? "Creating..." : "Create API key"}</button>
      </form>

      {message ? <p>{message}</p> : null}
      {newKey ? <pre className="secret">{newKey}</pre> : null}

      <h3>Existing keys</h3>
      {keys.length === 0 ? (
        <p>No keys created yet.</p>
      ) : (
        <ul>
          {keys.map((key) => (
            <li key={key.id}>
              <strong>{key.name}</strong> ({key.keyPrefix}...)
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
