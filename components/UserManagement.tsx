"use client";

import { FormEvent, useState } from "react";
import {
  Ban,
  Check,
  Edit3,
  Loader2,
  Shield,
  ShieldCheck,
  Unlock,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

export interface AdminUserItem {
  id: string;
  username: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  _count: {
    notes: number;
  };
}

interface UserManagementProps {
  initialUsers: AdminUserItem[];
  currentAdminId: string;
}

export default function UserManagement({
  initialUsers,
  currentAdminId,
}: UserManagementProps) {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);

  // Create form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [creating, setCreating] = useState(false);

  // Edit user state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "ADMIN">("USER");
  const [savingEdit, setSavingEdit] = useState(false);

  // Ban / unban confirm modal state
  const [banTarget, setBanTarget] = useState<AdminUserItem | null>(null);
  const [banning, setBanning] = useState(false);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể tạo người dùng.");
        return;
      }
      setUsers((prev) => [data.user, ...prev]);
      setNewUsername("");
      setNewPassword("");
      setNewRole("USER");
      toast.success(`Đã tạo tài khoản "${data.user.username}".`);
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user: AdminUserItem) {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditPassword("");
    setEditRole(user.role === "ADMIN" ? "ADMIN" : "USER");
  }

  async function saveEdit(userId: string) {
    if (!editUsername.trim()) {
      toast.error("Tên đăng nhập không được để trống.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editUsername.trim(),
          password: editPassword || undefined,
          role: editRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể cập nhật người dùng.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? data.user : u))
      );
      setEditingId(null);
      toast.success(`Đã cập nhật tài khoản "${data.user.username}".`);
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmBanToggle() {
    if (!banTarget) return;
    const nextBanned = !banTarget.isBanned;
    setBanning(true);
    try {
      const res = await fetch(`/api/admin/users/${banTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: nextBanned }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể thay đổi trạng thái khóa.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === banTarget.id ? data.user : u))
      );
      toast.success(
        nextBanned
          ? `Đã khóa tài khoản "${banTarget.username}".`
          : `Đã gỡ khóa cho tài khoản "${banTarget.username}".`
      );
      setBanTarget(null);
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setBanning(false);
    }
  }

  return (
    <div className="animate-fade-up grid gap-8 lg:grid-cols-12">
      {/* Create User Form */}
      <section className="lg:col-span-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Tạo tài khoản mới
              </h2>
              <p className="text-xs text-slate-500">
                Cấp tài khoản học viên hoặc quản trị viên
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên đăng nhập <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={32}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="vd: hocvien01"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Mật khẩu <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Vai trò
              </label>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value === "ADMIN" ? "ADMIN" : "USER")
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              >
                <option value="USER">Học viên (USER)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>Tạo tài khoản</span>
            </button>
          </form>
        </div>
      </section>

      {/* Users List */}
      <section className="lg:col-span-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Danh sách người dùng ({users.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((user) => {
              const isSelf = user.id === currentAdminId;
              const isEditing = editingId === user.id;

              return (
                <div key={user.id} className="py-4 first:pt-0 last:pb-0">
                  {isEditing ? (
                    <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Tên đăng nhập
                          </label>
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-600"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Mật khẩu mới (tùy chọn)
                          </label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Để trống nếu giữ nguyên"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-600"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Vai trò
                          </label>
                          <select
                            disabled={isSelf}
                            value={editRole}
                            onChange={(e) =>
                              setEditRole(
                                e.target.value === "ADMIN" ? "ADMIN" : "USER"
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-600 disabled:bg-slate-100"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Hủy</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => void saveEdit(user.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
                        >
                          {savingEdit ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>Lưu</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {user.username}
                          </span>
                          {isSelf && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              Bạn
                            </span>
                          )}
                          {user.role === "ADMIN" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 border border-teal-200/70">
                              <ShieldCheck className="h-3 w-3" />
                              ADMIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                              <Shield className="h-3 w-3 text-slate-500" />
                              USER
                            </span>
                          )}
                          {user.isBanned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200/70">
                              <Ban className="h-3 w-3" />
                              Đang bị khóa
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                          <span>{user._count.notes} ghi chú</span>
                          <span>•</span>
                          <span>
                            Tạo ngày{" "}
                            {new Date(user.createdAt).toLocaleDateString(
                              "vi-VN"
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </button>

                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => setBanTarget(user)}
                            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                              user.isBanned
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100"
                            }`}
                          >
                            {user.isBanned ? (
                              <>
                                <Unlock className="h-3.5 w-3.5" />
                                <span>Gỡ ban</span>
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5" />
                                <span>Ban</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(banTarget)}
        variant={banTarget?.isBanned ? "primary" : "danger"}
        title={
          banTarget?.isBanned
            ? "Gỡ khóa tài khoản này?"
            : "Khóa (Ban) tài khoản này?"
        }
        description={
          banTarget
            ? banTarget.isBanned
              ? `Tài khoản "${banTarget.username}" sẽ có thể đăng nhập lại bình thường.`
              : `Tài khoản "${banTarget.username}" sẽ bị đăng xuất ngay lập tức và không thể đăng nhập cho tới khi được gỡ khóa.`
            : ""
        }
        confirmText={banTarget?.isBanned ? "Gỡ khóa" : "Khóa tài khoản"}
        loading={banning}
        onConfirm={() => void confirmBanToggle()}
        onCancel={() => setBanTarget(null)}
      />
    </div>
  );
}
