"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserCheck, Shield, ToggleLeft, ToggleRight, Trash2, KeyRound, Mail, AlertCircle, Check, UserPlus, X, Lock, CheckCircle2 } from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { supabase } from "@/src/shared/lib/supabase";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";

export function UserManagementModule() {
  const { role, user: currentUser } = useNestor();

  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempEmpId, setTempEmpId] = useState("");

  // Modals state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "member">("member");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Reset password form state
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Fetch all profiles from Supabase
  const fetchProfiles = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setProfiles(data || []);
      }
    } catch (err: any) {
      setErrorMsg("Failed to retrieve profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === "admin") {
      fetchProfiles();
    }
  }, [role]);

  // Presence state helpers
  const isUserOnline = (lastSeenStr: string | null) => {
    if (!lastSeenStr) return false;
    const lastSeen = new Date(lastSeenStr);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    return diffMs < 5 * 60 * 1000; // Available if active within last 5 minutes
  };

  const formatLastSeen = (lastSeenStr: string | null) => {
    if (!lastSeenStr) return "Never active";
    const lastSeen = new Date(lastSeenStr);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Create new user via secure RPC
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword) return;

    setFormSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data, error } = await supabase!.rpc("admin_create_user", {
        p_email: newEmail.trim(),
        p_password: newPassword,
        p_username: newUsername.trim(),
        p_role: newUserRole,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        // If user specified an employee ID, update the profile record
        const createdUserId = data;
        if (createdUserId && newEmployeeId.trim()) {
          const { error: profileError } = await supabase!.rpc("admin_update_user_employee_id", {
            p_user_id: createdUserId,
            p_employee_id: newEmployeeId.trim(),
          });
          if (profileError) {
            throw profileError;
          }
        }

        setSuccessMsg(`User ${newUsername} created successfully. Initial password: ${newPassword}`);
        setIsAddUserOpen(false);
        // Reset inputs
        setNewUsername("");
        setNewEmail("");
        setNewPassword("");
        setNewUserRole("member");
        setNewEmployeeId("");
        fetchProfiles();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create user.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Recover/Change password directly via secure RPC
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !recoveryPassword) return;

    setResetSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { error } = await supabase!.rpc("admin_reset_password", {
        p_user_id: selectedUser.id,
        p_new_password: recoveryPassword,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(`Password for ${selectedUser.username} has been reset. User will be prompted to reset upon next login.`);
        setIsResetPassOpen(false);
        setRecoveryPassword("");
        setSelectedUser(null);
        fetchProfiles();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password.");
    } finally {
      setResetSubmitting(false);
    }
  };

  // Delete user account via secure RPC
  const handleDeleteUser = async (userId: string, name: string) => {
    if (userId === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }

    if (confirm(`Are you absolutely sure you want to permanently delete the user account "${name}"? This action CANNOT be undone.`)) {
      setErrorMsg("");
      setSuccessMsg("");
      try {
        const { error } = await supabase!.rpc("admin_delete_user", {
          p_user_id: userId,
        });

        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg(`User "${name}" has been deleted.`);
          fetchProfiles();
          setTimeout(() => setSuccessMsg(""), 4000);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to delete user account.");
      }
    }
  };

  // Update profile role (admin vs member)
  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (userId === currentUser?.id) {
      alert("You cannot change your own role.");
      return;
    }

    const nextRole = currentRole === "admin" ? "member" : "admin";
    if (confirm(`Change this user's role to ${nextRole}?`)) {
      try {
        const { error } = await supabase!
          .from("profiles")
          .update({ role: nextRole })
          .eq("id", userId);

        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg("User role updated successfully.");
          fetchProfiles();
          setTimeout(() => setSuccessMsg(""), 3000);
        }
      } catch (err) {
        setErrorMsg("Failed to update user role.");
      }
    }
  };

  // Update profile status (active vs disabled)
  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    if (userId === currentUser?.id) {
      alert("You cannot disable your own account.");
      return;
    }

    const nextStatus = currentStatus === "active" ? "disabled" : "active";
    if (confirm(`Set this user's account status to ${nextStatus}?`)) {
      try {
        const { error } = await supabase!
          .from("profiles")
          .update({ status: nextStatus })
          .eq("id", userId);

        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg(`User account is now ${nextStatus}.`);
          fetchProfiles();
          setTimeout(() => setSuccessMsg(""), 3000);
        }
      } catch (err) {
        setErrorMsg("Failed to update user status.");
      }
    }
  };

  // Update profile Employee ID mapping
  const handleSaveEmployeeId = async (userId: string) => {
    try {
      const { error } = await supabase!
        .from("profiles")
        .update({ employee_id: tempEmpId.trim() || null })
        .eq("id", userId);

      if (error) {
        // 23505 = unique_violation (profiles_employee_id_unique) — this
        // Employee ID is already mapped to a different account, which would
        // otherwise silently merge that account's shift roster into this one.
        setErrorMsg(
          error.code === "23505"
            ? `Employee ID "${tempEmpId.trim()}" is already assigned to another user. Each user must have a unique Employee ID.`
            : error.message
        );
      } else {
        setSuccessMsg("Employee ID mapping saved successfully.");
        setEditingId(null);
        fetchProfiles();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      setErrorMsg("Failed to save Employee ID.");
    }
  };

  if (role !== "admin") {
    return (
      <div className="p-6 text-center space-y-4">
        <h2 className="text-lg font-bold text-text-primary">Access Denied</h2>
        <p className="text-sm text-text-soft">Only administrative accounts can view or manage users.</p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-slate-50 dark:focus:bg-[#111c30] transition-all duration-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight flex items-center gap-2.5">
            <Users size={26} className="text-accent-cyan" /> User Management
          </h1>
          <p className="text-xs text-text-soft mt-1">
            Create user accounts, manage permission roles, map employee IDs, view online availability, and recovery passwords.
          </p>
        </div>

        <button
          onClick={() => setIsAddUserOpen(true)}
          className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus size={14} />
          <span>Add User Account</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-input bg-danger/10 border border-danger/20 text-xs text-danger flex items-start gap-2 max-w-xl">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-input bg-accent-cyan/10 border border-accent-cyan/20 text-xs text-accent-cyan flex items-start gap-2 max-w-xl">
          <Check size={15} className="mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Profiles Table */}
      <div className="rounded-card border shadow-soft overflow-hidden dark:border-white/5 dark:bg-card-bg bg-white">
        {loading ? (
          <div className="py-16 text-center text-xs text-text-soft">Loading team user records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 dark:border-white/5 dark:bg-white/[0.01] text-[11px] font-extrabold text-text-primary">
                  <th className="py-3 px-4">User Details</th>
                  <th className="py-3 px-4">Presence</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5">
                {profiles.map((profile) => {
                  const online = isUserOnline(profile.last_seen_at);
                  const isCurrent = profile.id === currentUser?.id;

                  return (
                    <tr key={profile.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                      {/* User profile details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary text-xs">
                            {profile.username || "Pending Account setup"}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-text-soft border border-white/5">
                              You
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-text-soft mt-0.5 flex items-center gap-1.5">
                          <Mail size={10} /> {profile.email}
                        </div>
                      </td>

                      {/* Presence status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${online ? "bg-accent-cyan animate-pulse" : "bg-text-muted"}`} />
                          <span className={`text-[10px] font-semibold ${online ? "text-accent-cyan" : "text-text-soft"}`}>
                            {online ? "Online (Available)" : `Offline (${formatLastSeen(profile.last_seen_at)})`}
                          </span>
                        </div>
                      </td>

                      {/* Employee ID mapping */}
                      <td className="py-3.5 px-4 font-mono">
                        {editingId === profile.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={tempEmpId}
                              onChange={(e) => setTempEmpId(e.target.value)}
                              placeholder="Employee ID"
                              className="rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090f1a] px-2 py-1 text-[10px] w-24 outline-none text-text-primary"
                            />
                            <button
                              onClick={() => handleSaveEmployeeId(profile.id)}
                              className="bg-accent-cyan text-white p-1 rounded hover:scale-105 transition-transform cursor-pointer"
                              title="Save"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="bg-white/5 text-text-soft p-1 rounded hover:bg-white/10 transition-colors cursor-pointer text-[10px]"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span className={profile.employee_id ? "text-accent-cyan font-bold" : "text-text-muted italic"}>
                              {profile.employee_id || "Unmapped"}
                            </span>
                            <button
                              onClick={() => {
                                setEditingId(profile.id);
                                setTempEmpId(profile.employee_id || "");
                              }}
                              className="text-text-soft hover:text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                              title="Map Employee ID"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Role badge */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleRole(profile.id, profile.role)}
                          disabled={isCurrent}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${isCurrent ? "cursor-not-allowed opacity-80" : "cursor-pointer"} ${
                            profile.role === "admin"
                              ? "bg-accent-purple/15 text-accent-purple border-accent-purple/20 hover:bg-accent-purple/20"
                              : "bg-slate-500/15 text-text-soft border-slate-500/20 hover:bg-slate-500/20"
                          }`}
                          title={isCurrent ? "Cannot change your own role" : "Click to toggle user role"}
                        >
                          <Shield size={10} />
                          <span className="capitalize">{profile.role}</span>
                        </button>
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(profile.id, profile.status)}
                          disabled={isCurrent}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${isCurrent ? "cursor-not-allowed opacity-80" : "cursor-pointer"} ${
                            profile.status === "active"
                              ? "bg-accent-cyan/15 text-accent-cyan border-accent-cyan/20 hover:bg-accent-cyan/20"
                              : profile.status === "pending"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                              : "bg-danger/15 text-danger border-danger/20 hover:bg-danger/20"
                          }`}
                          title={isCurrent ? "Cannot toggle your own status" : "Click to toggle status"}
                        >
                          <UserCheck size={10} />
                          <span className="capitalize">{profile.status}</span>
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(profile);
                              setIsResetPassOpen(true);
                            }}
                            className="rounded-btn border border-slate-200 dark:border-white/10 dark:bg-white/5 hover:bg-white/10 p-2 text-text-soft hover:text-text-primary transition-all flex items-center gap-1 font-semibold cursor-pointer"
                            title="Direct password recovery"
                          >
                            <KeyRound size={13} />
                            <span>Recovery</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUser(profile.id, profile.username || profile.email)}
                            disabled={isCurrent}
                            className={`rounded-btn p-2 border transition-all ${
                              isCurrent 
                                ? "opacity-30 cursor-not-allowed border-transparent text-text-muted" 
                                : "border-danger/10 bg-danger/5 hover:bg-danger hover:text-white text-danger cursor-pointer"
                            }`}
                            title={isCurrent ? "Cannot delete yourself" : "Delete Account permanently"}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: ADD USER ACCOUNT ── */}
      <AnimatePresence>
        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddUserOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="z-10 w-full max-w-md rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0b0f19] light:border-slate-200 light:bg-white overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4 dark:border-white/5 light:border-slate-100">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <UserPlus size={18} className="text-accent-cyan" /> Add New User
                </h3>
                <button
                  onClick={() => setIsAddUserOpen(false)}
                  className="rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddUserSubmit} className="p-6 space-y-4">
                {/* Dummy inputs to intercept browser autofill */}
                <input type="text" name="prevent_autofill_username" style={{ display: 'none' }} />
                <input type="password" name="prevent_autofill_password" style={{ display: 'none' }} />

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Username / Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className={inputCls}
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className={inputCls}
                    autoComplete="new-email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputCls}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Permission Role
                  </label>
                  <CustomSelect
                    value={newUserRole}
                    onChange={(val) => setNewUserRole(val as any)}
                    options={[
                      { value: "member", label: "Member (MSS Engineer)" },
                      { value: "admin", label: "Admin (Administrator)" },
                    ]}
                    width="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Employee ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. EMP-1002"
                    autoComplete="off"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="rounded-btn bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-text-soft hover:text-text-primary transition-all duration-200 cursor-pointer uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {formSubmitting ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: PASSWORD RECOVERY / DIRECT RESET ── */}
      <AnimatePresence>
        {isResetPassOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsResetPassOpen(false);
                setSelectedUser(null);
              }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="z-10 w-full max-w-md rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0b0f19] light:border-slate-200 light:bg-white overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4 dark:border-white/5 light:border-slate-100">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Lock size={18} className="text-accent-cyan" /> Recover Password
                </h3>
                <button
                  onClick={() => {
                    setIsResetPassOpen(false);
                    setSelectedUser(null);
                  }}
                  className="rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                <div className="rounded p-3 bg-white/5 border border-white/5 text-[11px] text-text-soft space-y-1">
                  <div><strong>User:</strong> {selectedUser.username || "No Username"}</div>
                  <div><strong>Email:</strong> {selectedUser.email}</div>
                  <div className="text-amber-400 mt-1.5 flex items-center gap-1 font-semibold">
                    <CheckCircle2 size={12} />
                    <span>User status will be set to 'pending' to force reset on login.</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Direct New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                    placeholder="Enter new recovery password"
                    className={inputCls}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPassOpen(false);
                      setSelectedUser(null);
                    }}
                    className="rounded-btn bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-text-soft hover:text-text-primary transition-all duration-200 cursor-pointer uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {resetSubmitting ? "Updating..." : "Override Password"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
