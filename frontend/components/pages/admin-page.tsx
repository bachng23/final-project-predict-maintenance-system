"use client";

import { useState } from "react";
import {
  Search,
  ChevronDown,
  Plus,
  X,
  Eye,
  EyeOff,
  Pencil,
  Check,
  Power,
} from "lucide-react";

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE: [string, string][] = [
  ["#fef3c7", "#92400e"],
  ["#dcfce7", "#166534"],
  ["#dbeafe", "#1e40af"],
  ["#fce7f3", "#9d174d"],
  ["#e0e7ff", "#3730a3"],
  ["#fee2e2", "#991b1b"],
  ["#cffafe", "#155e75"],
  ["#fae8ff", "#86198f"],
];

function avatarColors(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const [bg, fg] = avatarColors(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: fg,
      display: "inline-grid", placeItems: "center",
      fontSize: size < 32 ? 11 : 12, fontWeight: 600,
      letterSpacing: "0.02em", flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

// ─── Role pill ────────────────────────────────────────────────────────────────

type Role = "ADMIN" | "ENGINEER" | "OPERATOR" | "VIEWER";

function RolePill({ role }: { role: Role }) {
  const map: Record<Role, { bg: string; fg: string; border: string }> = {
    ADMIN:    { bg: "var(--color-slate-text)", fg: "#fff",    border: "transparent" },
    ENGINEER: { bg: "var(--color-sky-tint)",   fg: "#0c4a6e", border: "#bae6fd" },
    OPERATOR: { bg: "var(--color-emerald-tint)", fg: "#065f46", border: "#bbf7d0" },
    VIEWER:   { bg: "#f5f5f4", fg: "var(--color-ash-gray)", border: "var(--color-stone-border)" },
  };
  const s = map[role] ?? map.VIEWER;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 9px", borderRadius: 9999,
      background: s.bg, color: s.fg,
      border: `1px solid ${s.border}`,
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em",
    }}>
      {role}
    </span>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function ActiveDot({ active }: { active: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%",
        background: active ? "#10b981" : "#a8a29e" }} />
      <span style={{ color: active ? "var(--color-slate-text)" : "var(--color-ash-gray)" }}>
        {active ? "Active" : "Inactive"}
      </span>
    </span>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <span
        onClick={() => onChange(!on)}
        style={{
          display: "inline-block",
          width: 36, height: 20,
          borderRadius: 9999,
          background: on ? "var(--color-chartwell-blue)" : "var(--color-platinum-outline)",
          position: "relative", transition: "background 0.15s",
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: on ? 19 : 3,
          width: 14, height: 14, borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }} />
      </span>
      <span style={{ fontSize: 13, color: "var(--color-slate-text)" }}>{label}</span>
    </label>
  );
}

// ─── Form atoms ───────────────────────────────────────────────────────────────

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 12, fontWeight: 500, color: "var(--color-slate-text)" }}>
        <span>{label}</span>
        {hint && <span style={{ fontSize: 11, color: "var(--color-ash-gray)", fontWeight: 400 }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  height: 36, padding: "0 12px",
  border: "1px solid var(--color-platinum-outline)",
  borderRadius: 6,
  background: "var(--color-cloud-white)",
  color: "var(--color-slate-text)",
  fontFamily: "inherit", fontSize: 13.5,
  outline: "none", width: "100%",
};

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style ?? {}) }} />;
}

function FormSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      ...inputStyle,
      padding: "0 28px 0 12px",
      appearance: "none", WebkitAppearance: "none",
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>")`,
      backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
    }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <FormInput type={show ? "text" : "password"} value={value} onChange={onChange}
        placeholder={placeholder} style={{ paddingRight: 36 }} />
      <button type="button" onClick={() => setShow(v => !v)} title={show ? "Hide" : "Show"}
        style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          width: 28, height: 28, borderRadius: 4,
          background: "transparent", border: 0,
          color: "var(--color-ash-gray)", cursor: "pointer",
          display: "grid", placeItems: "center", padding: 0,
        }}>
        {show ? <EyeOff width={15} height={15} /> : <Eye width={15} height={15} />}
      </button>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ value, label, tone = "neutral" }: { value: number; label: string; tone?: "neutral" | "emerald" | "stone" }) {
  const tones = {
    neutral: { bg: "var(--color-canvas-fog)", border: "var(--color-stone-border)", fg: "var(--color-slate-text)" },
    emerald: { bg: "var(--color-emerald-tint)", border: "#bbf7d0", fg: "#065f46" },
    stone:   { bg: "#f5f5f4", border: "var(--color-stone-border)", fg: "var(--color-ash-gray)" },
  };
  const t = tones[tone];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      background: t.bg, border: `1px solid ${t.border}`,
      borderRadius: 9999, padding: "8px 16px",
    }}>
      <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.012em", color: t.fg, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 13, color: "var(--color-ash-gray)" }}>{label}</span>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  lastLogin: string;
  lastLoginFull: string;
};

const SEED_USERS: User[] = [
  { id: "u1", name: "Bach Nguyen",  username: "bach_admin", email: "bach.n@marco.ai",  role: "ADMIN",    active: true,  lastLogin: "Just now",    lastLoginFull: "May 14 at 09:42" },
  { id: "u2", name: "Minh Tran",    username: "minh_eng",   email: "minh.t@marco.ai",  role: "ENGINEER", active: true,  lastLogin: "3 hours ago", lastLoginFull: "May 14 at 06:30" },
  { id: "u3", name: "Linh Pham",    username: "linh_ops",   email: "linh.p@marco.ai",  role: "OPERATOR", active: true,  lastLogin: "Yesterday",   lastLoginFull: "May 13 at 17:08" },
  { id: "u4", name: "Duc Nguyen",   username: "duc_ops2",   email: "duc.n@marco.ai",   role: "OPERATOR", active: true,  lastLogin: "2 days ago",  lastLoginFull: "May 12 at 14:22" },
  { id: "u5", name: "Tuan Le",      username: "tuan_view",  email: "tuan.l@marco.ai",  role: "VIEWER",   active: false, lastLogin: "2 weeks ago", lastLoginFull: "Apr 30 at 11:14" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminPage() {
  const [users, setUsers] = useState<User[]>(SEED_USERS);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");

  const [addForm, setAddForm] = useState({ name: "", username: "", password: "", role: "OPERATOR" as Role });
  const [editForm, setEditForm] = useState<{ name: string; email: string; role: Role; active: boolean; password: string } | null>(null);

  function openEdit(u: User) {
    setShowAdd(false);
    setEditingId(u.id);
    setEditForm({ name: u.name, email: u.email, role: u.role, active: u.active, password: "" });
  }
  function cancelEdit() { setEditingId(null); setEditForm(null); }
  function saveEdit() {
    if (!editForm) return;
    setUsers(users.map(u => u.id === editingId
      ? { ...u, name: editForm.name, email: editForm.email, role: editForm.role, active: editForm.active }
      : u));
    cancelEdit();
  }
  function toggleActive(u: User) {
    setUsers(users.map(x => x.id === u.id ? { ...x, active: !x.active } : x));
  }
  function submitAdd() {
    if (!addForm.name || !addForm.username || !addForm.password) return;
    setUsers([...users, {
      id: "u" + (users.length + 1),
      name: addForm.name,
      username: addForm.username,
      email: addForm.username + "@marco.ai",
      role: addForm.role,
      active: true,
      lastLogin: "Never",
      lastLoginFull: "—",
    }]);
    setAddForm({ name: "", username: "", password: "", role: "OPERATOR" });
    setShowAdd(false);
  }

  const roleOptions = ["All roles", "ADMIN", "ENGINEER", "OPERATOR", "VIEWER"];

  const filtered = users.filter(u => {
    if (roleFilter !== "All roles" && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeCount = users.filter(u => u.active).length;
  const inactiveCount = users.length - activeCount;

  // shared button styles
  const btnPrimary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    height: 34, padding: "0 14px",
    background: "var(--color-chartwell-blue)", color: "#fff",
    border: 0, borderRadius: 9999,
    fontFamily: "inherit", fontSize: 13, fontWeight: 500,
    cursor: "pointer",
  };
  const btnGhost: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    height: 34, padding: "0 14px",
    background: "transparent", color: "var(--color-ash-gray)",
    border: "1px solid var(--color-stone-border)", borderRadius: 9999,
    fontFamily: "inherit", fontSize: 13, fontWeight: 500,
    cursor: "pointer",
  };
  const btnGhostSm: React.CSSProperties = { ...btnGhost, height: 28, padding: "0 10px", fontSize: 12 };

  return (
    <main style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200 }}>
      {/* Page header */}
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 12,
          fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em",
          color: "var(--color-slate-text)", margin: "0 0 6px" }}>
          User Management
          <span style={{
            fontSize: 10, letterSpacing: "0.08em",
            background: "var(--color-slate-text)", color: "white",
            padding: "2px 8px", borderRadius: 9999, fontWeight: 700,
          }}>ADMIN ONLY</span>
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ash-gray)" }}>
          Manage operators, engineers, and viewers across the Marco.ai workspace.
        </p>
      </div>

      {/* Stats + toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <StatPill value={users.length} label="Total Users" />
        <StatPill value={activeCount} label="Active" tone="emerald" />
        <StatPill value={inactiveCount} label="Inactive" tone="stone" />
        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 34, padding: "0 12px",
          border: "1px solid var(--color-platinum-outline)",
          borderRadius: 9999, background: "var(--color-cloud-white)", width: 240,
        }}>
          <Search width={13} height={13} style={{ color: "var(--color-ash-gray)", flexShrink: 0 }} />
          <input
            placeholder="Search by name or username…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, border: 0, outline: "none", background: "transparent",
              fontFamily: "inherit", fontSize: 12.5, color: "var(--color-slate-text)" }}
          />
        </div>

        {/* Role filter */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          height: 34, padding: "0 12px",
          border: "1px solid var(--color-stone-border)",
          borderRadius: 9999, background: "var(--color-cloud-white)",
          cursor: "pointer", position: "relative",
        }}>
          <span style={{ fontSize: 12.5, color: "var(--color-ash-gray)" }}>Role:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{
              border: 0, outline: "none", background: "transparent",
              fontFamily: "inherit", fontSize: 12.5, color: "var(--color-slate-text)",
              cursor: "pointer", appearance: "none", paddingRight: 16,
            }}>
            {roleOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown width={12} height={12} style={{ color: "var(--color-ash-gray)", pointerEvents: "none" }} />
        </div>

        <button style={btnPrimary} onClick={() => { setShowAdd(s => !s); setEditingId(null); }}>
          <Plus width={13} height={13} />
          Add User
        </button>
      </div>

      {/* Inline Add form */}
      {showAdd && (
        <div style={{
          background: "var(--color-cloud-white)",
          border: "1px solid var(--color-stone-border)",
          borderLeft: "3px solid var(--color-chartwell-blue)",
          borderRadius: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            padding: "18px 24px 0" }}>
            <div>
              <h3 style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600,
                color: "var(--color-slate-text)", display: "flex", alignItems: "center", gap: 8 }}>
                <Plus width={15} height={15} style={{ color: "var(--color-chartwell-blue)" }} />
                Create new user
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-ash-gray)" }}>
                Issue access credentials for a new Marco.ai operator, engineer, or viewer.
              </p>
            </div>
            <button onClick={() => setShowAdd(false)} style={{ ...btnGhostSm, padding: "0 8px" }}>
              <X width={12} height={12} />
            </button>
          </div>

          <div style={{ padding: "20px 24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <FormField label="Full Name">
                <FormInput type="text" value={addForm.name} placeholder="e.g. Hoa Nguyen"
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
              </FormField>
              <FormField label="Username">
                <FormInput type="text" value={addForm.username} placeholder="e.g. hoa_ops"
                  onChange={e => setAddForm({ ...addForm, username: e.target.value })} />
              </FormField>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <FormField label="Password" hint="Min 8 characters">
                <PasswordInput value={addForm.password} placeholder="••••••••"
                  onChange={e => setAddForm({ ...addForm, password: e.target.value })} />
              </FormField>
              <FormField label="Role">
                <FormSelect value={addForm.role}
                  onChange={v => setAddForm({ ...addForm, role: v as Role })}
                  options={["ADMIN", "ENGINEER", "OPERATOR", "VIEWER"]} />
              </FormField>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center",
              paddingTop: 12, borderTop: "1px solid var(--color-stone-border)" }}>
              <button style={btnPrimary} onClick={submitAdd}>Create user</button>
              <button style={btnGhost} onClick={() => setShowAdd(false)}>Cancel</button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--color-ash-gray)" }}>
                A welcome email with sign-in instructions will be sent to the user.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: "var(--color-cloud-white)",
        border: "1px solid var(--color-stone-border)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-stone-border)" }}>
              {["User", "Username", "Role", "Status", "Last login", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "10px 16px", textAlign: i === 5 ? "right" : "left",
                  fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em",
                  color: "var(--color-ash-gray)", textTransform: "uppercase",
                  background: "var(--color-canvas-fog)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const isEditing = editingId === u.id;
              return (
                <>
                  <tr key={u.id} style={{
                    borderBottom: "1px solid var(--color-stone-border)",
                    background: isEditing ? "var(--color-canvas-fog)" : undefined,
                  }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-slate-text)" }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--color-ash-gray)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--color-ash-gray)" }}>
                        {u.username}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}><RolePill role={u.role} /></td>
                    <td style={{ padding: "12px 16px" }}><ActiveDot active={u.active} /></td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, color: "var(--color-slate-text)" }}>{u.lastLogin}</div>
                      <div style={{ fontSize: 11, color: "var(--color-ash-gray)" }}>{u.lastLoginFull}</div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button style={btnGhostSm}
                        onClick={() => isEditing ? cancelEdit() : openEdit(u)}>
                        <Pencil width={12} height={12} />
                        {isEditing ? "Editing…" : "Edit"}
                      </button>
                      <button
                        title={u.active ? "Deactivate user" : "Activate user"}
                        onClick={() => toggleActive(u)}
                        style={{
                          marginLeft: 6,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: 6,
                          border: `1px solid ${u.active ? "var(--color-stone-border)" : "#bbf7d0"}`,
                          background: u.active ? "var(--color-cloud-white)" : "var(--color-emerald-tint)",
                          color: u.active ? "var(--color-ash-gray)" : "#10b981",
                          cursor: "pointer",
                        }}>
                        <Power width={14} height={14} />
                      </button>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {isEditing && editForm && (
                    <tr key={u.id + "-edit"} style={{ background: "var(--color-canvas-fog)",
                      borderBottom: "1px solid var(--color-stone-border)" }}>
                      <td colSpan={6} style={{ padding: "4px 16px 18px" }}>
                        <div style={{
                          background: "var(--color-cloud-white)",
                          border: "1px solid var(--color-stone-border)",
                          borderLeft: "3px solid var(--color-chartwell-blue)",
                          borderRadius: 8, padding: "18px 22px",
                          display: "flex", flexDirection: "column", gap: 16,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={u.name} size={36} />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-slate-text)" }}>
                                Edit user · {u.name}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--color-ash-gray)" }}>
                                Username{" "}
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{u.username}</span>
                                {" "}— cannot be changed
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <FormField label="Full Name">
                              <FormInput type="text" value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                            </FormField>
                            <FormField label="Email">
                              <FormInput type="email" value={editForm.email}
                                onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                            </FormField>
                          </div>

                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                            <FormField label="Role">
                              <FormSelect value={editForm.role}
                                onChange={v => setEditForm({ ...editForm, role: v as Role })}
                                options={["ADMIN", "ENGINEER", "OPERATOR", "VIEWER"]} />
                            </FormField>
                            <FormField label="Reset password" hint="Leave blank to keep current">
                              <PasswordInput value={editForm.password}
                                placeholder="Set a new password (optional)"
                                onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
                            </FormField>
                            <div style={{
                              display: "flex", flexDirection: "column", gap: 8,
                              padding: "8px 14px",
                              border: "1px solid var(--color-stone-border)",
                              borderRadius: 6, minWidth: 180, height: 60,
                              justifyContent: "center",
                            }}>
                              <span style={{ fontSize: 11, color: "var(--color-ash-gray)", letterSpacing: "0.04em" }}>
                                Account status
                              </span>
                              <Switch on={editForm.active}
                                onChange={v => setEditForm({ ...editForm, active: v })}
                                label={editForm.active ? "Active" : "Inactive"} />
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 10, alignItems: "center",
                            paddingTop: 10, borderTop: "1px solid var(--color-stone-border)" }}>
                            <button style={btnPrimary} onClick={saveEdit}>
                              <Check width={13} height={13} /> Save changes
                            </button>
                            <button style={btnGhost} onClick={cancelEdit}>Cancel</button>
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 11, color: "var(--color-ash-gray)" }}>
                              Changes apply to{" "}
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{u.username}</span>
                              {" "}immediately.
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {/* Pagination footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px",
          borderTop: "1px solid var(--color-stone-border)",
          fontSize: 12.5, color: "var(--color-ash-gray)",
        }}>
          <span>Showing {filtered.length} of {users.length} users</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["‹", "1", "›"].map((p, i) => (
              <button key={i} style={{
                width: 28, height: 28, borderRadius: 6,
                border: "1px solid var(--color-stone-border)",
                background: i === 1 ? "var(--color-chartwell-blue)" : "var(--color-cloud-white)",
                color: i === 1 ? "#fff" : "var(--color-ash-gray)",
                fontFamily: "inherit", fontSize: 13, cursor: i === 0 || i === 2 ? "default" : "pointer",
                display: "grid", placeItems: "center",
                opacity: (i === 0 || i === 2) ? 0.4 : 1,
              }}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
