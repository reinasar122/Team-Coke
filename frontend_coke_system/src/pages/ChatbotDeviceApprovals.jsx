import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FaUserShield } from "react-icons/fa";

import api from "../api";

const statusOptions = ["PENDING", "APPROVED", "REJECTED", "REVOKED"];

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
  REVOKED: "bg-slate-200 text-slate-800 border-slate-300",
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getRoleName = (user) =>
  String(user?.role_name || user?.role?.name || user?.role || "")
    .trim()
    .toLowerCase();

const formatDateTime = (value) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.detail ||
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  fallback;

export default function ChatbotDeviceApprovals() {
  const [devices, setDevices] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actingDeviceId, setActingDeviceId] = useState(null);
  const [error, setError] = useState("");

  const user = useMemo(getStoredUser, []);
  const adminUserId = user?.id;
  const isAdmin = ["admin", "administrator", "super admin"].includes(getRoleName(user));

  const adminHeaders = useMemo(
    () => ({
      "X-Admin-User-ID": String(adminUserId || ""),
    }),
    [adminUserId]
  );

  const loadDevices = useCallback(async () => {
    if (!adminUserId || !isAdmin) {
      setError("Only Admin users can approve chatbot devices.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const response = await api.get("/chatbot/admin/devices/", {
        params,
        headers: adminHeaders,
      });
      setDevices(response.data?.data || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load chatbot devices."));
    } finally {
      setLoading(false);
    }
  }, [adminHeaders, adminUserId, isAdmin, search, statusFilter]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const decideDevice = async (device, action) => {
    const actionLabels = {
      approve: "approve",
      reject: "reject",
      revoke: "revoke",
    };

    if (!window.confirm(`Are you sure you want to ${actionLabels[action]} this device?`)) {
      return;
    }

    let reason = "";
    if (action === "reject" || action === "revoke") {
      reason = window.prompt("Reason for this decision:", "") || "";
    }

    setActingDeviceId(device.authorized_device_id);
    setError("");
    try {
      const response = await api.post(
        `/chatbot/admin/devices/${device.authorized_device_id}/${action}/`,
        { reason },
        { headers: adminHeaders }
      );
      const nextDevice = response.data?.data;
      setDevices((current) =>
        current.map((item) =>
          item.authorized_device_id === nextDevice.authorized_device_id ? nextDevice : item
        )
      );
      toast.success(response.data?.message || "Device updated.");
    } catch (decisionError) {
      const message = getErrorMessage(decisionError, "Failed to update device.");
      setError(message);
      toast.error(message);
    } finally {
      setActingDeviceId(null);
    }
  };

  const counts = devices.reduce(
    (summary, device) => ({
      ...summary,
      [device.status]: (summary[device.status] || 0) + 1,
    }),
    {}
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">
          <FaUserShield className="page-title-icon" aria-hidden="true" />
          <span>Chatbot Device Approvals</span>
        </h2>
      </div>

      <div className="min-h-full bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
                  AI Chatbot Security
                </p>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">
                  Approve only the customer phone that should access chat, catalog, cart, and orders.
                  Login alone is not enough; the device must be approved here.
                </p>
              </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="min-w-[240px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                placeholder="Search customer, phone, device"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadDevices();
                }}
              />
              <button
                type="button"
                onClick={loadDevices}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {["ALL", ...statusOptions].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                statusFilter === status
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <span className="block text-xs font-bold uppercase tracking-wide">{status}</span>
              <span className="mt-1 block text-2xl font-black">
                {status === "ALL" ? devices.length : counts[status] || 0}
              </span>
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-black text-slate-950">Customer Device Requests</h2>
            <p className="text-sm text-slate-500">
              Showing up to 100 devices. Use search if the list gets noisy.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Device</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Activity</th>
                  <th className="px-5 py-3">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan="5">
                      Loading device requests...
                    </td>
                  </tr>
                ) : devices.length ? (
                  devices.map((device) => {
                    const isActing = actingDeviceId === device.authorized_device_id;
                    return (
                      <tr key={device.authorized_device_id} className="align-top hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <div className="font-black text-slate-950">{device.customer_name}</div>
                          <div className="mt-1 text-slate-600">{device.phone_number}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {device.warehouse_name || "No warehouse"}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">
                            {device.device_name || "Unnamed device"}
                          </div>
                          <div className="mt-1 text-slate-600">
                            {(device.platform || "unknown").toUpperCase()} {device.os_version || ""}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            App {device.app_version || "unknown"} / IP {device.last_ip || "unknown"}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                              statusStyles[device.status] || "border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {device.status}
                          </span>
                          {device.rejection_reason ? (
                            <div className="mt-2 max-w-xs text-xs text-red-700">
                              Rejected: {device.rejection_reason}
                            </div>
                          ) : null}
                          {device.revocation_reason ? (
                            <div className="mt-2 max-w-xs text-xs text-slate-700">
                              Revoked: {device.revocation_reason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          <div>Requested: {formatDateTime(device.created_at)}</div>
                          <div>Last seen: {formatDateTime(device.last_seen_at)}</div>
                          {device.approved_at ? <div>Approved: {formatDateTime(device.approved_at)}</div> : null}
                          {device.rejected_at ? <div>Rejected: {formatDateTime(device.rejected_at)}</div> : null}
                          {device.revoked_at ? <div>Revoked: {formatDateTime(device.revoked_at)}</div> : null}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {device.status !== "APPROVED" ? (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => decideDevice(device, "approve")}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            ) : null}
                            {device.status === "PENDING" ? (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => decideDevice(device, "reject")}
                                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            ) : null}
                            {device.status === "APPROVED" ? (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => decideDevice(device, "revoke")}
                                className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-900 disabled:opacity-50"
                              >
                                Revoke
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan="5">
                      No devices found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
