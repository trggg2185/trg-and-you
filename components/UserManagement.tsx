"use client";

import { FormEvent, useState } from "react";
import {
  Ban,
  Check,
  CheckCircle2,
  Crown,
  Edit3,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import UserAvatar from "@/components/UserAvatar";
import { isSuperAdminRole, type UserRole } from "@/lib/jwt";

export interface AdminUserItem {
  id: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  hasGoogle?: boolean;
  hasPassword?: boolean;
  role: string;
  isBanned: boolean;
  createdAt: string;
  _count: {
    notes: number;
    sharedNotes?: number;
    progresses?: number;
    vocabItems?: number;
    savedSentences?: number;
  };
}

interface UserManagementProps {
  initialUsers: AdminUserItem[];
  currentAdminId: string;
  currentRole: UserRole;
  onUserCountChange?: (count: number) => void;
}

export default function UserManagement({
  initialUsers,
  currentAdminId,
  currentRole,
  onUserCountChange,
}: UserManagementProps) {
  const toast = useToast();
  const actorIsSuper = isSuperAdminRole(currentRole);
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);

  // Invite / pre-create by Google email form state
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [creating, setCreating] = useState(false);

  // Edit user state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "ADMIN">("USER");
  const [savingEdit, setSavingEdit] = useState(false);

  // Ban / unban confirm modal state
  const [banTarget, setBanTarget] = useState<AdminUserItem | null>(null);
  const [banning, setBanning] = useState(false);

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<AdminUserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  function canManageTarget(user: AdminUserItem): boolean {
    if (user.id === currentAdminId) return false;
    if (user.role === "SUPERADMIN") return false;
    if (!actorIsSuper && user.role !== "USER") return false;
    return true;
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    setDeletingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa tài khoản.");
        return;
      }
      const nextUsers = users.filter((u) => u.id !== deleteTarget.id);
      setUsers(nextUsers);
      onUserCountChange?.(nextUsers.length);
      toast.success(`Đã xóa tài khoản "${deleteTarget.username}".`);
      setDeleteTarget(null);
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setDeletingUser(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          username: newUsername.trim() || undefined,
          role: actorIsSuper ? newRole : "USER",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể thêm tài khoản.");
        return;
      }
      const nextUsers = [data.user, ...users];
      setUsers(nextUsers);
      onUserCountChange?.(nextUsers.length);
      setNewEmail("");
      setNewUsername("");
      setNewRole("USER");
      toast.success(`Đã thêm Gmail "${data.user.email}".`);
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user: AdminUserItem) {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditRole(user.role === "ADMIN" ? "ADMIN" : "USER");
  }

  async function saveEdit(userId: string) {
    if (!editUsername.trim()) {
      toast.error("Tên hiển thị không được để trống.");
      return;
    }
    setSavingEdit(true);
    try {
      const payload: { username: string; role?: "USER" | "ADMIN" } = {
        username: editUsername.trim(),
      };
      if (actorIsSuper) {
        payload.role = editRole;
      }
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      {/* Pre-register / Invite by Gmail */}
      <section className="min-w-0 lg:col-span-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Thêm bằng Email Google
              </h2>
              <p className="text-xs text-slate-500">
                {actorIsSuper
                  ? "Cấp sẵn quyền (USER / ADMIN) theo Gmail"
                  : "Thêm trước học viên (USER) theo Gmail"}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Địa chỉ Gmail / Google <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="vd: banbe@gmail.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên hiển thị (tùy chọn)
              </label>
              <input
                type="text"
                minLength={3}
                maxLength={32}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Tự lấy từ Gmail nếu để trống"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Vai trò
              </label>
              <select
                disabled={!actorIsSuper}
                value={actorIsSuper ? newRole : "USER"}
                onChange={(e) =>
                  setNewRole(e.target.value === "ADMIN" ? "ADMIN" : "USER")
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="USER">Học viên (USER)</option>
                {actorIsSuper && (
                  <option value="ADMIN">Quản trị viên (ADMIN)</option>
                )}
              </select>
              {!actorIsSuper && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Chỉ SuperAdmin mới có quyền cấp vai trò ADMIN.
                </p>
              )}
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
              <span>Thêm người dùng Google</span>
            </button>
          </form>
        </div>
      </section>

      {/* Users List */}
      <section className="min-w-0 lg:col-span-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Danh sách người dùng ({users.length})
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {actorIsSuper
                ? "Quyền SuperAdmin: quản lý toàn bộ USER & ADMIN"
                : "Quyền ADMIN: chỉ quản lý học viên (USER)"}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((user) => {
              const isSelf = user.id === currentAdminId;
              const isEditing = editingId === user.id;
              const manageable = canManageTarget(user);

              return (
                <div key={user.id} className="py-4 first:pt-0 last:pb-0">
                  {isEditing ? (
                    <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Tên hiển thị
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
                            Vai trò
                          </label>
                          <select
                            disabled={!actorIsSuper}
                            value={editRole}
                            onChange={(e) =>
                              setEditRole(
                                e.target.value === "ADMIN" ? "ADMIN" : "USER"
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-600 disabled:bg-slate-100 disabled:text-slate-500"
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
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <UserAvatar
                          src={user.avatarUrl}
                          name={user.username}
                          sizeClass="h-9 w-9 mt-0.5"
                          textClass="text-xs"
                        />

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
                            {user.role === "SUPERADMIN" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                <Crown className="h-3 w-3" />
                                SUPERADMIN
                              </span>
                            ) : user.role === "ADMIN" ? (
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
                            {user.hasGoogle ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/80">
                                <CheckCircle2 className="h-3 w-3" />
                                Google
                              </span>
                            ) : user.hasPassword ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200/80">
                                <KeyRound className="h-3 w-3" />
                                Chờ liên kết Google
                              </span>
                            ) : null}
                            {user.isBanned && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200/70">
                                <Ban className="h-3 w-3" />
                                Đang bị khóa
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                            {user.email && (
                              <>
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  {user.email}
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span>{user._count.notes} ghi chú</span>
                            {(user._count.sharedNotes ?? 0) > 0 && (
                              <>
                                <span>•</span>
                                <span>{user._count.sharedNotes} ghi chú nhóm/bình luận</span>
                              </>
                            )}
                            {(user._count.vocabItems ?? 0) > 0 && (
                              <>
                                <span>•</span>
                                <span>{user._count.vocabItems} từ vựng</span>
                              </>
                            )}
                            <span>•</span>
                            <span>
                              Tạo ngày{" "}
                              {new Date(user.createdAt).toLocaleDateString(
                                "vi-VN"
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {manageable ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(user)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Sửa</span>
                            </button>

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

                            {actorIsSuper && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(user)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Xóa</span>
                              </button>
                            )}
                          </>
                        ) : (
                          !isSelf && (
                            <span className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
                              <Lock className="h-3 w-3" />
                              <span>
                                {user.role === "SUPERADMIN"
                                  ? "Được bảo vệ"
                                  : "Chỉ SuperAdmin"}
                              </span>
                            </span>
                          )
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

      <ConfirmModal
        open={Boolean(deleteTarget)}
        variant="danger"
        title="Xóa vĩnh viễn tài khoản này?"
        description={
          deleteTarget
            ? (() => {
                const c = deleteTarget._count;
                const hasActivity =
                  c.notes +
                    (c.sharedNotes ?? 0) +
                    (c.progresses ?? 0) +
                    (c.vocabItems ?? 0) +
                    (c.savedSentences ?? 0) >
                  0;
                if (!hasActivity) {
                  return `Tài khoản "${deleteTarget.username}" chưa có dữ liệu học tập hay bình luận nào và sẽ bị xóa hoàn toàn.`;
                }
                return `CẢNH BÁO: Tài khoản "${deleteTarget.username}" đang có ${
                  c.progresses ?? 0
                } tiến độ bài học, ${c.vocabItems ?? 0} từ vựng, ${
                  c.notes
                } ghi chú cá nhân và ${
                  c.sharedNotes ?? 0
                } ghi chú nhóm/bình luận. Xóa vĩnh viễn sẽ mất toàn bộ dữ liệu trên (kể cả câu trả lời con dưới bài đăng của họ). Nên dùng nút "Ban" nếu chỉ muốn ngừng truy cập.`;
              })()
            : ""
        }
        confirmText="Vẫn xóa vĩnh viễn"
        loading={deletingUser}
        onConfirm={() => void confirmDeleteUser()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
