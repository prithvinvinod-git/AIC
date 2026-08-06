"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { Loading, EmptyState } from "@/components/ui/States";
import { DEPARTMENTS, ROLE_LABEL } from "@/lib/constants";
import type { AppUser, Category, Team, Role } from "@/lib/types";

const TABS = ["Users", "Teams", "Categories", "Config"] as const;
type Tab = (typeof TABS)[number];

const ALL_ROLES: Role[] = ["reporter", "validator", "hod", "principal", "maintenance", "head", "admin"];

export default function AdminPage() {
  const { claims } = useAuth();
  const [tab, setTab] = useState<Tab>("Users");

  if (!claims) return null;
  if (claims.role !== "admin") {
    return <EmptyState title="Admin only" body="This area is restricted to administrators." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Admin</h1>
        <p className="mt-1 text-sm text-slate">Manage users, teams, categories and SLA defaults.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Users" && <UsersTab />}
      {tab === "Teams" && <TeamsTab />}
      {tab === "Categories" && <CategoriesTab />}
      {tab === "Config" && <ConfigTab />}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [role, setRole] = useState<Role>("reporter");
  const department = DEPARTMENTS[0];

  const load = useCallback(async () => {
    try {
      const res = await api<{ users: AppUser[] }>("/api/admin/users");
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load users.");
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await api("/api/auth/provision", {
          method: "POST",
          body: JSON.stringify({ name, email, password, role, department }),
        });
        setName("");
        setEmail("");
        await load();
      } catch (e2) {
        setError(e2 instanceof ApiError ? e2.message : "Failed to create user.");
      }
    },
    [name, email, password, role, department, load]
  );

  const updateUser = useCallback(
    async (uid: string, patch: Partial<AppUser>) => {
      try {
        await api(`/api/auth/provision`, {
          method: "PATCH",
          body: JSON.stringify({ uid, ...patch }),
        });
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to update user.");
      }
    },
    [load]
  );

  if (!users) return <Loading label="Loading users…" />;

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}

      <form onSubmit={addUser} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary btn-sm">
          Add user
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver text-left text-xs uppercase tracking-wide text-slate">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} className="border-b border-silver last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-graphite">{u.name}</p>
                  <p className="text-xs text-slate">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-slate">{u.department}</td>
                <td className="px-4 py-3">
                  <select
                    className="input w-auto py-1 text-xs"
                    value={u.role}
                    onChange={(e) => void updateUser(u.uid || "", { role: e.target.value as Role })}
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    className={`btn btn-sm ${u.isActive ? "btn-ghost" : "btn-primary"}`}
                    onClick={() => void updateUser(u.uid || "", { isActive: !u.isActive })}
                  >
                    {u.isActive ? "Active" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, u, c] = await Promise.all([
      api<{ teams: Team[] }>("/api/admin/teams"),
      api<{ users: AppUser[] }>("/api/admin/users"),
      api<{ categories: Category[] }>("/api/admin/categories"),
    ]);
    setTeams(t.teams);
    setUsers(u.users);
    setCategories(c.categories);
    if (!categoryId && c.categories.length) setCategoryId(c.categories[0].id || "");
  }, [categoryId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await api("/api/admin/teams", {
          method: "POST",
          body: JSON.stringify({ name, categoryId, members, isActive: true }),
        });
        setName("");
        setMembers([]);
        await load();
      } catch (e2) {
        setError(e2 instanceof ApiError ? e2.message : "Failed to create team.");
      }
    },
    [name, categoryId, members, load]
  );

  const maintenanceStaff = users.filter((u) => u.role === "maintenance" || u.role === "head");

  if (!teams) return <Loading label="Loading teams…" />;

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}

      <form onSubmit={create} className="card flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="Team name (e.g. Electrical Crew)" required value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="label">Members</p>
          <div className="flex flex-wrap gap-2">
            {maintenanceStaff.map((u) => {
              const checked = members.includes(u.uid || "");
              return (
                <button
                  key={u.uid}
                  type="button"
                  className={`tag ${checked ? "bg-ink text-white" : "tag-outline"}`}
                  onClick={() =>
                    setMembers((prev) =>
                      checked ? prev.filter((m) => m !== u.uid) : [...prev, u.uid || ""]
                    )
                  }
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn-primary btn-sm">
            Create team
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver text-left text-xs uppercase tracking-wide text-slate">
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-b border-silver last:border-0">
                <td className="px-4 py-3 font-medium text-graphite">{t.name}</td>
                <td className="px-4 py-3 text-slate">{t.categoryId}</td>
                <td className="px-4 py-3 text-slate">{(t.members || []).length} staff</td>
                <td className="px-4 py-3">
                  <span className={`tag ${t.isActive ? "" : "bg-[#fef2f2] text-[#c0392b]"}`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ categories: Category[] }>("/api/admin/categories");
      setCategories(res.categories);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load categories.");
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await api("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify({
            name,
            slaResponseHours: 12,
            slaResolutionHours: 72,
            isActive: true,
          }),
        });
        setName("");
        await load();
      } catch (e2) {
        setError(e2 instanceof ApiError ? e2.message : "Failed to create category.");
      }
    },
    [name, load]
  );

  if (!categories) return <Loading label="Loading categories…" />;

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}
      <form onSubmit={create} className="card flex gap-3">
        <input className="input flex-1" placeholder="Category name (e.g. HVAC)" required value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-sm">
          Add category
        </button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver text-left text-xs uppercase tracking-wide text-slate">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Response SLA (h)</th>
              <th className="px-4 py-3">Resolution SLA (h)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-silver last:border-0">
                <td className="px-4 py-3 font-medium text-graphite">{c.name}</td>
                <td className="px-4 py-3 text-slate">{c.slaResponseHours}</td>
                <td className="px-4 py-3 text-slate">{c.slaResolutionHours}</td>
                <td className="px-4 py-3">
                  <span className={`tag ${c.isActive ? "" : "bg-[#fef2f2] text-[#c0392b]"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfigTab() {
  const [config, setConfig] = useState<{ feedbackGraceHours?: number; assignmentMode?: string; aiEnabled?: boolean; aiThreshold?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ config: { feedbackGraceHours: number; assignmentMode: string; ai: { enabled: boolean; threshold: number } } }>("/api/admin/config");
      setConfig({
        feedbackGraceHours: res.config.feedbackGraceHours,
        assignmentMode: res.config.assignmentMode,
        aiEnabled: res.config.ai.enabled,
        aiThreshold: res.config.ai.threshold,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load config.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaved(false);
      try {
        await api("/api/admin/config", {
          method: "PATCH",
          body: JSON.stringify({
            feedbackGraceHours: config?.feedbackGraceHours,
            assignmentMode: config?.assignmentMode,
            ai: { enabled: config?.aiEnabled, threshold: config?.aiThreshold },
          }),
        });
        setSaved(true);
      } catch (e2) {
        setError(e2 instanceof ApiError ? e2.message : "Failed to save config.");
      }
    },
    [config]
  );

  if (!config) return <Loading label="Loading config…" />;

  return (
    <form onSubmit={save} className="card flex max-w-xl flex-col gap-4">
      {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="grace">
            Feedback grace (hours)
          </label>
          <input
            id="grace"
            className="input"
            type="number"
            min={1}
            value={config.feedbackGraceHours}
            onChange={(e) => setConfig({ ...config, feedbackGraceHours: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label" htmlFor="mode">
            Assignment mode
          </label>
          <select
            id="mode"
            className="input"
            value={config.assignmentMode}
            onChange={(e) => setConfig({ ...config, assignmentMode: e.target.value })}
          >
            <option value="claim">Claim</option>
            <option value="assign">Assign</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate">
        <input
          type="checkbox"
          checked={Boolean(config.aiEnabled)}
          onChange={(e) => setConfig({ ...config, aiEnabled: e.target.checked })}
        />
        Enable AI assistance
      </label>
      {saved && <p className="text-sm text-[#2e7d32]">Configuration saved.</p>}
      <div>
        <button type="submit" className="btn btn-primary btn-sm">
          Save configuration
        </button>
      </div>
    </form>
  );
}
