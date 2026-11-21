import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Save, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { pvRoleOf, PV_ROLES } from "@/lib/pv";
import { asList, useSettings } from "@/hooks/usePv";
import { saveSettings, sendDueCaseAlerts, setUserRole } from "@/lib/server-fns";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";

export const Route = createFileRoute("/_authed/settings")({
  head: () => ({ meta: [{ title: "Settings · SafetyScan PV" }] }),
  component: SettingsPage,
});

const field =
  "h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[13px] outline-none focus:border-[#0D9488]";

function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = pvRoleOf(user) === "Admin";
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const saveFn = useServerFn(saveSettings);
  const alertFn = useServerFn(sendDueCaseAlerts);
  const roleFn = useServerFn(setUserRole);

  const [form, setForm] = useState({
    search_frequency: "Weekly",
    confidence_threshold: 85,
    qc_sample_percentage: 10,
    email_alerts: true,
    reviewer_email: "",
    deadline_alert_days: [5, 2],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      search_frequency: settings.search_frequency || "Weekly",
      confidence_threshold: settings.confidence_threshold ?? 85,
      qc_sample_percentage: settings.qc_sample_percentage ?? 10,
      email_alerts: settings.email_alerts !== false,
      reviewer_email: settings.reviewer_email || "",
      deadline_alert_days: settings.deadline_alert_days?.length ? settings.deadline_alert_days : [5, 2],
    });
  }, [settings?.id, settings?.updated_date]);

  const { data: users = [] } = useQuery({
    queryKey: ["pv", "users"],
    enabled: isAdmin,
    queryFn: async () => asList(await base44.entities.User.list()),
  });

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: settings?.id,
          search_frequency: form.search_frequency,
          confidence_threshold: Number(form.confidence_threshold),
          qc_sample_percentage: Number(form.qc_sample_percentage),
          email_alerts: form.email_alerts,
          reviewer_email: form.reviewer_email,
          deadline_alert_days: form.deadline_alert_days,
        },
      });
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const sendAlerts = async () => {
    try {
      const result = await alertFn({});
      toast.success(
        result.skipped
          ? "Email alerts are turned off."
          : result.sent
            ? `${result.sent} alert email${result.sent === 1 ? "" : "s"} sent.`
            : "No case is at the 5-day or 2-day mark right now.",
      );
    } catch (error) {
      toast.error(error?.message || "Could not send alerts.");
    }
  };

  const assignRole = async (userId, pvRole) => {
    try {
      await roleFn({ data: { userId, pv_role: pvRole } });
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["pv", "users"] });
    } catch (error) {
      toast.error(error?.message || "Could not change the role.");
    }
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      deadline_alert_days: prev.deadline_alert_days.includes(day)
        ? prev.deadline_alert_days.filter((d) => d !== day)
        : [...prev.deadline_alert_days, day].sort((a, b) => b - a),
    }));
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Search cadence, the confidence floor below which nothing is auto-excluded, the quality-control sample and reviewer alerts."
        actions={
          isAdmin && (
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save settings"}
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="surface-card p-4 lg:col-span-7">
          <h2 className="text-[13px] font-bold text-[#0F172A]">Search and triage</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#475569]">Search frequency</label>
              <select
                className={field}
                value={form.search_frequency}
                onChange={(e) => setForm((prev) => ({ ...prev, search_frequency: e.target.value }))}
                disabled={!isAdmin}
              >
                <option>Weekly</option>
                <option>Bi-weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#475569]">Auto-exclude confidence threshold</label>
              <input
                type="number"
                min={0}
                max={100}
                className={field}
                value={form.confidence_threshold}
                onChange={(e) => setForm((prev) => ({ ...prev, confidence_threshold: e.target.value }))}
                disabled={!isAdmin}
              />
              <p className="mt-1 text-[10.5px] text-[#64748B]">Below this, AI exclusions go to human review.</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#475569]">QC sample percentage</label>
              <input
                type="number"
                min={0}
                max={100}
                className={field}
                value={form.qc_sample_percentage}
                onChange={(e) => setForm((prev) => ({ ...prev, qc_sample_percentage: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#475569]">Reviewer alert email</label>
              <input
                type="email"
                className={field}
                value={form.reviewer_email}
                onChange={(e) => setForm((prev) => ({ ...prev, reviewer_email: e.target.value }))}
                placeholder="medical.reviewer@company.ca"
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="mt-4 border-t border-[#E2E8F0] pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-[#0D9488]" />
                <p className="text-[12px] font-semibold text-[#0F172A]">Email the Medical Reviewer</p>
              </div>
              <label className="flex items-center gap-2 text-[11px] font-medium text-[#475569]">
                <input
                  type="checkbox"
                  checked={form.email_alerts}
                  onChange={(e) => setForm((prev) => ({ ...prev, email_alerts: e.target.checked }))}
                  disabled={!isAdmin}
                  className="h-4 w-4 accent-[#0D9488]"
                />
                Enabled
              </label>
            </div>
            <p className="mt-1 text-[11px] text-[#64748B]">Sent when a potential reportable case is confirmed, and before a due date.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {[5, 2].map((day) => (
                <label key={day} className="flex items-center gap-1.5 text-[11px] font-medium text-[#475569]">
                  <input
                    type="checkbox"
                    checked={form.deadline_alert_days.includes(day)}
                    onChange={() => toggleDay(day)}
                    disabled={!isAdmin}
                    className="h-3.5 w-3.5 accent-[#0D9488]"
                  />
                  {day} days before due
                </label>
              ))}
              <button
                onClick={sendAlerts}
                className="ml-auto rounded-md border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-semibold text-[#1E293B] hover:bg-slate-50"
              >
                Send due-date alerts now
              </button>
            </div>
          </div>
        </section>

        <section className="surface-card p-4 lg:col-span-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0D9488]" />
            <h2 className="text-[13px] font-bold text-[#0F172A]">Team roles</h2>
          </div>
          <p className="mt-1 text-[11px] text-[#64748B]">
            Inspectors have read-only access to the audit trail, search logs and cases.
          </p>
          <ul className="mt-3 divide-y divide-[#E2E8F0]">
            {users.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[#0F172A]">{member.full_name || member.email}</p>
                  <p className="truncate text-[10.5px] text-[#64748B]">{member.email}</p>
                </div>
                {isAdmin ? (
                  <select
                    value={member.pv_role || (member.role === "admin" ? "Admin" : "PV Associate")}
                    onChange={(e) => assignRole(member.id, e.target.value)}
                    className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2 text-[11px]"
                  >
                    {PV_ROLES.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <StatusPill tone="slate">{member.pv_role || "PV Associate"}</StatusPill>
                )}
              </li>
            ))}
            {!users.length && (
              <li className="py-4 text-center text-[11.5px] text-[#64748B]">
                {isAdmin ? "No team members yet. Invite users from the app dashboard." : "Only an Admin can see team roles."}
              </li>
            )}
          </ul>
          <p className="mt-3 rounded bg-[#F8FAFC] px-2.5 py-2 text-[10.5px] text-[#64748B]">
            Your role: <span className="font-semibold text-[#0F172A]">{pvRoleOf(user)}</span>. Admins can see and change all
            records and manage users.
          </p>
        </section>
      </div>
    </>
  );
}