"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type UserItem = {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "USER";
  projectLimit: number;
  projectCount: number;
  allowedDomains: string[];
  createdAt: string;
  updatedAt: string;
};

type UsersPayload = {
  users: UserItem[];
  managedDomains: string[];
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

export function UserManagementPanel() {
  const [payload, setPayload] = useState<UsersPayload>({ users: [], managedDomains: [] });
  const [busy, setBusy] = useState(false);
  const [saveBusyId, setSaveBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "USER" as "USER" | "ADMIN",
    projectLimit: 2,
  });
  const [limitDrafts, setLimitDrafts] = useState<Record<string, number>>({});
  const [domainDrafts, setDomainDrafts] = useState<Record<string, Set<string>>>({});

  async function load() {
    const response = await fetch("/api/v1/admin/users", { cache: "no-store" });
    const body = (await response.json()) as ApiResponse<UsersPayload>;
    if (!response.ok || !body.success || !body.data) {
      setError(body.error?.message ?? "Unable to load users");
      return;
    }
    setPayload(body.data);
    setLimitDrafts(
      Object.fromEntries(body.data.users.map((user) => [user.id, user.projectLimit])),
    );
    setDomainDrafts(
      Object.fromEntries(body.data.users.map((user) => [user.id, new Set(user.allowedDomains)])),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleDomain(userId: string, domain: string) {
    setDomainDrafts((current) => {
      const next = new Set(current[userId] ?? []);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return { ...current, [userId]: next };
    });
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/v1/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const body = (await response.json()) as ApiResponse<UserItem>;
    if (!response.ok || !body.success) {
      setError(body.error?.message ?? "Unable to create user");
      setBusy(false);
      return;
    }
    setMessage(`User ${newUser.username} created.`);
    setNewUser({
      username: "",
      email: "",
      password: "",
      role: "USER",
      projectLimit: 2,
    });
    await load();
    setBusy(false);
  }

  async function saveUser(user: UserItem) {
    setSaveBusyId(user.id);
    setError("");
    setMessage("");
    const response = await fetch(`/api/v1/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectLimit: limitDrafts[user.id] ?? user.projectLimit,
        allowedDomains: Array.from(domainDrafts[user.id] ?? []),
      }),
    });
    const body = (await response.json()) as ApiResponse<UserItem>;
    if (!response.ok || !body.success) {
      setError(body.error?.message ?? "Unable to update user");
      setSaveBusyId("");
      return;
    }
    setMessage(`User ${user.username} updated.`);
    await load();
    setSaveBusyId("");
  }

  return (
    <section className="card preset-editor">
      <h2>User Management</h2>
      <p>Create users, set project limits and assign allowed DomNex apex domains per user.</p>

      <form onSubmit={createUser} className="bootstrap-box">
        <h3>Add User</h3>
        <label>Username</label>
        <input
          value={newUser.username}
          onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))}
          required
        />
        <label>Email</label>
        <input
          type="email"
          value={newUser.email}
          onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={newUser.password}
          onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
          required
        />
        <label>Role</label>
        <select
          value={newUser.role}
          onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as "USER" | "ADMIN" }))}
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <label>Project Limit (USER only)</label>
        <input
          type="number"
          min={1}
          value={newUser.projectLimit}
          onChange={(event) =>
            setNewUser((current) => ({ ...current, projectLimit: Number.parseInt(event.target.value || "2", 10) }))
          }
        />
        <button type="submit" disabled={busy}>{busy ? "Creating..." : "Create User"}</button>
      </form>

      <div className="detail-grid">
        {payload.users.map((user) => (
          <article key={user.id} className="detail-box">
            <h3>{user.username}</h3>
            <p>{user.email}</p>
            <p className="status-pill neutral">{user.role}</p>
            <p>Projects: {user.projectCount}</p>
            <label>Project Limit</label>
            <input
              type="number"
              min={1}
              disabled={user.role === "ADMIN"}
              value={limitDrafts[user.id] ?? user.projectLimit}
              onChange={(event) =>
                setLimitDrafts((current) => ({
                  ...current,
                  [user.id]: Number.parseInt(event.target.value || "1", 10),
                }))
              }
            />
            <p className="ops-muted">Allowed Apex Domains</p>
            {payload.managedDomains.length === 0 ? (
              <p className="ops-muted">No managed domains yet.</p>
            ) : (
              <div className="ops-compact-list">
                {payload.managedDomains.map((domain) => (
                  <label key={`${user.id}-${domain}`} className="checkbox-label">
                    <input
                      type="checkbox"
                      disabled={user.role === "ADMIN"}
                      checked={Boolean(domainDrafts[user.id]?.has(domain))}
                      onChange={() => toggleDomain(user.id, domain)}
                    />
                    {domain}
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => saveUser(user)}
              disabled={saveBusyId === user.id}
            >
              {saveBusyId === user.id ? "Saving..." : "Save User"}
            </button>
          </article>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p>{message}</p> : null}
    </section>
  );
}
