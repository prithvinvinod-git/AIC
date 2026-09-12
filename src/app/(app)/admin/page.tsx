"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { Loading } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { useActionError } from "@/components/ui/Toast";
import { CATEGORY_SCOPED_ROLES, COLLEGES, DEPARTMENTS_BY_COLLEGE, ROLE_LABEL, type College } from "@/lib/constants";
import { assertRouteAccess } from "@/lib/roleGuards";
import type { AppUser, Category, Team, Role } from "@/lib/types";

const TABS = ["Users", "Teams", "Categories", "Config"] as const;
type Tab = (typeof TABS)[number];

const ALL_ROLES: Role[] = [
  "reporter",
  "validator",
  "hod",
  "principal",
  "maintenance_head",
  "category_head",
  "maintenance",
  "purchase",
  "admin",
];

const USER_TABS = ["Regular users", "Faculties"] as const;
type UserTab = (typeof USER_TABS)[number];

const FACULTY_ROLES: Role[] = [
  "validator",
  "hod",
  "principal",
  "maintenance_head",
  "category_head",
  "maintenance",
  "purchase",
  "admin",
];

export default function AdminPage() {
  const { claims } = useAuth();
  const [tab, setTab] = useState<Tab>("Users");

  if (!claims) return null;
  assertRouteAccess(claims, ["admin"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Admin</h1>
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
  const [userTab, setUserTab] = useState<UserTab>("Regular users");
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AppUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showError } = useActionError();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [role, setRole] = useState<Role>("validator");
  const [college, setCollege] = useState<College>(COLLEGES[0]);
  const [department, setDepartment] = useState<string>(DEPARTMENTS_BY_COLLEGE[COLLEGES[0]][0]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");

  const load = useCallback(async () => {
    try {
      const [res, cats] = await Promise.all([
        api<{ users: AppUser[] }>("/api/admin/users"),
        api<{ categories: Category[] }>("/api/categories"),
      ]);
      setUsers(res.users);
      setCategories(cats.categories);
      setSelectedUser((prev) => {
        if (!prev) return prev;
        const fresh = res.users.find((x) => x.uid === prev.uid);
        return fresh ?? prev;
      });
    } catch (e) {
      showError(e);
      setUsers([]);
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const isFaculty = userTab === "Faculties";
  const addRole: Role = isFaculty ? role : "reporter";
  const depts = DEPARTMENTS_BY_COLLEGE[college];
  const categoryScoped = (CATEGORY_SCOPED_ROLES as Role[]).includes(addRole);
  const noAssignment = addRole === "maintenance_head" || addRole === "principal";
  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "—";

  // Keep the add-form category picker populated once categories load.
  useEffect(() => {
    if (!categoryId && categories[0]?.id) setCategoryId(categories[0].id as string);
  }, [categoryId, categories]);

  const addUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await api("/api/auth/provision", {
          method: "POST",
          body: JSON.stringify({
            name,
            email,
            password,
            role: addRole,
            college,
            department: noAssignment || categoryScoped ? "" : department,
            ...(categoryScoped ? { categoryId } : {}),
          }),
        });
        setName("");
        setEmail("");
        await load();
      } catch (e2) {
        showError(e2);
      }
    },
    [name, email, password, addRole, college, department, categoryScoped, categoryId, noAssignment, load, showError]
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
        showError(e);
      }
    },
    [load, showError]
  );

  const deleteUser = useCallback(
    async (u: AppUser) => {
      if (!u.uid) return;
      setDeleting(true);
      try {
        await api(`/api/admin/users?uid=${encodeURIComponent(u.uid)}`, { method: "DELETE" });
        setPendingDelete(null);
        await load();
      } catch (e) {
        showError(e);
      } finally {
        setDeleting(false);
      }
    },
    [load, showError]
  );

  if (!users) return <Loading label="Loading users…" />;

  const visible = isFaculty
    ? users.filter((u) => u.role !== "reporter")
    : users.filter((u) => u.role === "reporter");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {USER_TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`btn btn-sm ${userTab === t ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setUserTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={addUser} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        {isFaculty ? (
          <select
            className="input"
            value={role}
            onChange={(e) => {
              const next = e.target.value as Role;
              setRole(next);
              if (next === "maintenance_head" || next === "principal") setDepartment("");
              if ((CATEGORY_SCOPED_ROLES as Role[]).includes(next)) {
                setDepartment("");
                if (categories[0]?.id) setCategoryId((prev) => prev || (categories[0].id as string));
              }
            }}
          >
            {FACULTY_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        ) : (
          <select className="input" value={addRole} disabled>
            <option value="reporter">{ROLE_LABEL.reporter}</option>
          </select>
        )}
        <button type="submit" className="btn btn-primary btn-sm lg:order-5">
          Add user
        </button>
        <select
          className="input lg:order-6"
          value={college}
          onChange={(e) => {
            const next = e.target.value as College;
            setCollege(next);
            setDepartment(DEPARTMENTS_BY_COLLEGE[next][0]);
          }}
        >
          {COLLEGES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {noAssignment ? (
          <select className="input lg:order-7" disabled value="">
            <option value="">
              {addRole === "principal" ? "— Principal has no department" : "— No category / department"}
            </option>
          </select>
        ) : categoryScoped ? (
          <select
            className="input lg:order-7"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id as string}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="input lg:order-7"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </form>

      <div className="card flex flex-col p-0 overflow-hidden max-h-[480px] max-md:max-h-[70vh]">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate">
              <th className="w-[30%] max-md:w-[40%] border-b border-silver bg-white px-4 py-3 max-md:px-3 max-md:py-1.5">User</th>
              <th className="w-[17%] max-md:w-[30%] border-b border-silver bg-white px-4 py-3 max-md:px-3 max-md:py-1.5">College</th>
              <th className="w-[17%] max-md:w-[30%] border-b border-silver bg-white px-4 py-3 max-md:px-3 max-md:py-1.5">Dept / Category</th>
              <th className="w-[14%] max-md:hidden border-b border-silver bg-white px-4 py-3 max-md:px-3 max-md:py-1.5">Role</th>
              <th className="w-[22%] max-md:hidden border-b border-silver bg-white px-4 py-3 max-md:px-3 max-md:py-1.5 text-right">Actions</th>
            </tr>
          </thead>
        </table>
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <tbody className="[&_tr:last-child_td]:border-b-0">
              {visible.map((u) => (
                <tr
                  key={u.uid}
                  className="max-md:cursor-pointer max-md:hover:bg-paper/70"
                  onClick={() => {
                    if (window.matchMedia("(max-width: 767.98px)").matches) setSelectedUser(u);
                  }}
                >
                  <td className="w-[30%] max-md:w-[40%] border-b border-silver px-4 py-3 max-md:px-3 max-md:py-1.5">
                    <p className="truncate font-medium text-graphite max-md:text-[13px] max-md:leading-tight">{u.name}</p>
                    <p className="truncate text-xs font-medium text-accent max-md:text-[11px] max-md:leading-tight">{ROLE_LABEL[u.role]}</p>
                    <p className="truncate text-xs text-slate max-md:text-[11px] max-md:leading-tight">{u.email}</p>
                  </td>
                  <td className="w-[17%] max-md:w-[30%] truncate border-b border-silver px-4 py-3 max-md:px-3 max-md:py-1.5 text-slate max-md:text-[11px]">{u.college || "—"}</td>
                  <td className="w-[17%] max-md:w-[30%] border-b border-silver px-4 py-3 max-md:px-3 max-md:py-1.5 text-slate max-md:text-[11px]">{u.role === "principal" || u.role === "maintenance_head"
                    ? "—"
                    : (CATEGORY_SCOPED_ROLES as Role[]).includes(u.role)
                      ? categoryName(u.categoryId)
                      : u.department || "—"}</td>
                  <td className="w-[14%] max-md:hidden border-b border-silver px-4 py-3 max-md:px-3 max-md:py-1.5">
                    <select
                      className="input w-full py-1 text-xs max-md:py-0.5 max-md:text-[11px]"
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
                  <td className="w-[22%] max-md:hidden border-b border-silver px-4 py-3 max-md:px-3 max-md:py-1.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className={`btn btn-sm max-md:px-2 max-md:py-1 max-md:text-[11px] ${u.isActive ? "btn-ghost" : "btn-primary"}`}
                        onClick={() => void updateUser(u.uid || "", { isActive: !u.isActive })}
                      >
                        {u.isActive ? "Active" : "Disabled"}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-danger hover:bg-danger-soft max-md:px-2 max-md:py-1 max-md:text-[11px]"
                        onClick={() => setPendingDelete(u)}
                        aria-label={`Delete ${u.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate">
              {isFaculty ? "No faculties yet." : "No regular users yet."}
            </p>
          )}
        </div>
      </div>

      <Modal open={selectedUser !== null} onClose={() => setSelectedUser(null)} title={selectedUser?.name || "User"}>
        <div className="space-y-4">
          <div>
            <p className="break-all text-sm text-slate">{selectedUser?.email}</p>
            <p className="mt-1 text-xs text-slate">
              {selectedUser?.college || "—"}
              {selectedUser?.department ? ` · ${selectedUser.department}` : ""}
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Role</span>
            <select
              className="input w-full"
              value={selectedUser?.role}
              onChange={(e) => selectedUser?.uid && void updateUser(selectedUser.uid, { role: e.target.value as Role })}
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">College</span>
            <select
              className="input w-full"
              value={selectedUser?.college || ""}
              onChange={(e) => selectedUser?.uid && void updateUser(selectedUser.uid, { college: e.target.value })}
            >
              <option value="">—</option>
              {COLLEGES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {selectedUser?.role === "principal" || selectedUser?.role === "maintenance_head" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">
                {selectedUser.role === "principal" ? "Department" : "Category"}
              </span>
              <select className="input w-full" disabled value="">
                <option value="">
                  {selectedUser.role === "principal"
                    ? "— Principal has no department"
                    : "— Assigned via Categories tab"}
                </option>
              </select>
            </label>
          ) : (CATEGORY_SCOPED_ROLES as Role[]).includes(selectedUser?.role ?? ("reporter" as Role)) ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Category</span>
              <select
                className="input w-full"
                value={selectedUser?.categoryId || ""}
                onChange={(e) => selectedUser?.uid && void updateUser(selectedUser.uid, { categoryId: e.target.value })}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id as string}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Department</span>
              <select
                className="input w-full"
                value={selectedUser?.department || ""}
                onChange={(e) => selectedUser?.uid && void updateUser(selectedUser.uid, { department: e.target.value })}
              >
                <option value="">—</option>
                {selectedUser?.college &&
                  DEPARTMENTS_BY_COLLEGE[selectedUser.college as College].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm flex-1 ${selectedUser?.isActive ? "btn-ghost" : "btn-primary"}`}
              onClick={() => selectedUser?.uid && void updateUser(selectedUser.uid, { isActive: !selectedUser.isActive })}
            >
              {selectedUser?.isActive ? "Disable account" : "Enable account"}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                setPendingDelete(selectedUser);
                setSelectedUser(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={pendingDelete !== null} onClose={() => setPendingDelete(null)} title="Delete user">
        <p className="text-sm text-graphite">
          Delete <span className="font-semibold">{pendingDelete?.name}</span> ({pendingDelete?.email})? This
          removes their account and cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingDelete(null)} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => pendingDelete && void deleteUser(pendingDelete)}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
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
  const [failed, setFailed] = useState(false);
  const { showError } = useActionError();

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [t, u, c] = await Promise.all([
        api<{ teams: Team[] }>("/api/admin/teams"),
        api<{ users: AppUser[] }>("/api/admin/users"),
        api<{ categories: Category[] }>("/api/admin/categories"),
      ]);
      setTeams(t.teams);
      setUsers(u.users);
      setCategories(c.categories);
      if (!categoryId && c.categories.length) setCategoryId(c.categories[0].id || "");
    } catch (e) {
      setFailed(true);
      showError(e);
    }
  }, [categoryId, showError]);

  useEffect(() => {
    void load();
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
        showError(e2);
      }
    },
    [name, categoryId, members, load, showError]
  );

  const maintenanceStaff = users.filter((u) => u.role === "maintenance");

  if (failed) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <p className="text-sm text-slate">Couldn&apos;t load teams.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!teams) return <Loading label="Loading teams…" />;

  return (
    <div className="flex flex-col gap-4">
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
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Team</th>
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Category</th>
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Members</th>
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-b border-silver last:border-0">
                <td className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium text-graphite">{t.name}</td>
                <td className="px-4 py-3 max-md:px-3 max-md:py-2 text-slate">{t.categoryId}</td>
                <td className="px-4 py-3 max-md:px-3 max-md:py-2 text-slate">{(t.members || []).length} staff</td>
                <td className="px-4 py-3 max-md:px-3 max-md:py-2">
                  <span className={`tag ${t.isActive ? "" : "bg-danger-soft text-danger"}`}>
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
  const [heads, setHeads] = useState<AppUser[]>([]);
  const [name, setName] = useState("");
  const [headUid, setHeadUid] = useState("");
  const { showError } = useActionError();

  const load = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([
        api<{ categories: Category[] }>("/api/admin/categories"),
        api<{ users: AppUser[] }>("/api/admin/users"),
      ]);
      setCategories(c.categories);
      setHeads(u.users.filter((x) => x.role === "category_head"));
    } catch (e) {
      showError(e);
      setCategories([]);
    }
  }, [showError]);

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
            headUid: headUid || undefined,
            slaResponseHours: 12,
            slaResolutionHours: 72,
            isActive: true,
          }),
        });
        setName("");
        setHeadUid("");
        await load();
      } catch (e2) {
        showError(e2);
      }
    },
    [name, headUid, load, showError]
  );

  const setHead = useCallback(
    async (id: string | undefined, uid: string) => {
      try {
        await api(`/api/admin/categories/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ headUid: uid || undefined }),
        });
        await load();
      } catch (e2) {
        showError(e2);
      }
    },
    [load, showError]
  );

  if (!categories) return <Loading label="Loading categories…" />;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={create} className="card flex flex-wrap items-end gap-3">
        <input className="input flex-1" placeholder="Category name (e.g. HVAC)" required value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <label className="label" htmlFor="cat-head">
            Category head
          </label>
          <select id="cat-head" className="input" value={headUid} onChange={(e) => setHeadUid(e.target.value)}>
            <option value="">None</option>
            {heads.map((h) => (
              <option key={h.uid} value={h.uid || ""}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm">
          Add category
        </button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver text-left text-xs uppercase tracking-wide text-slate">
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Name</th>
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Category head</th>
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Response SLA (h)</th>
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Resolution SLA (h)</th>
              <th className="px-4 py-3 max-md:px-3 max-md:py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-silver last:border-0">
                <td className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium text-graphite">{c.name}</td>
                <td className="px-4 py-3 max-md:px-3 max-md:py-2">
                  <select
                    className="input w-auto py-1 text-xs"
                    value={c.headUid || ""}
                    onChange={(e) => void setHead(c.id, e.target.value)}
                  >
                    <option value="">None</option>
                    {heads.map((h) => (
                      <option key={h.uid} value={h.uid || ""}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 max-md:px-3 max-md:py-2 text-slate">{c.slaResponseHours}</td>
                <td className="px-4 py-3 max-md:px-3 max-md:py-2 text-slate">{c.slaResolutionHours}</td>
                <td className="px-4 py-3 max-md:px-3 max-md:py-2">
                  <span className={`tag ${c.isActive ? "" : "bg-danger-soft text-danger"}`}>
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
  const [config, setConfig] = useState<{ feedbackGraceHours?: number; assignmentMode?: string; purchaseApprovalLimit?: number; aiEnabled?: boolean; aiThreshold?: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const { showError } = useActionError();

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await api<{ config: { feedbackGraceHours: number; assignmentMode: string; purchaseApprovalLimit: number; ai: { enabled: boolean; threshold: number } } }>("/api/admin/config");
      setConfig({
        feedbackGraceHours: res.config.feedbackGraceHours,
        assignmentMode: res.config.assignmentMode,
        purchaseApprovalLimit: res.config.purchaseApprovalLimit,
        aiEnabled: res.config.ai.enabled,
        aiThreshold: res.config.ai.threshold,
      });
    } catch (e) {
      setFailed(true);
      showError(e);
    }
  }, [showError]);

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
            purchaseApprovalLimit: config?.purchaseApprovalLimit,
            ai: { enabled: config?.aiEnabled, threshold: config?.aiThreshold },
          }),
        });
        setSaved(true);
      } catch (e2) {
        showError(e2);
      }
    },
    [config, showError]
  );

  if (failed) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <p className="text-sm text-slate">Couldn&apos;t load configuration.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!config) return <Loading label="Loading config…" />;

  return (
    <form onSubmit={save} className="card flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
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
        <div>
          <label className="label" htmlFor="purchaseLimit">
            Purchase approval limit (₹)
          </label>
          <input
            id="purchaseLimit"
            className="input"
            type="number"
            min={0}
            step="any"
            value={config.purchaseApprovalLimit ?? 0}
            onChange={(e) => setConfig({ ...config, purchaseApprovalLimit: Number(e.target.value) })}
          />
          <p className="mt-1 text-xs text-slate">Purchases above this total need HOD/Principal approval.</p>
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
      {saved && <p className="text-sm text-success">Configuration saved.</p>}
      <div>
        <button type="submit" className="btn btn-primary btn-sm">
          Save configuration
        </button>
      </div>
    </form>
  );
}
