import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button, Input } from "../../ui/controls";
import { Select } from "../../ui/select";
import { Field } from "./fields";
import { useTranslation } from "./locale";
import type { AdminState } from "./useAdmin";

const messages = {
  en: {
    current: "Installed version",
    available: "Available version",
    check: "Check for updates",
    install: "Install and restart",
    unavailable:
      "The server updater is not connected. See the server update deployment guide.",
    hint: "Updates briefly interrupt chat. Running tasks finish first. Server data is backed up before installation.",
    scope:
      "Updates Core, the administration panel and the bundled chat client. Central identity and Synapse keep their installed versions.",
    policy: "Update policy",
    manual: "Manual checks",
    notify: "Check and notify",
    auto: "Install during maintenance window",
    channel: "Release channel",
    stable: "Stable",
    prerelease: "Include prereleases",
    start: "Window starts (hour)",
    end: "Window ends (hour)",
    zone: "Time zone",
    save: "Save update settings",
    release: "Release notes",
    incompatible:
      "This release requires a separate migration or is incompatible with this server.",
    history: "Update history",
    empty: "No updates have run yet.",
    reconnect: "Waiting for the administration service to return…",
    owner: "Only an instance owner can change or install server updates.",
    backup: "Backup completed",
    recover: "Retry recovery",
    idle: "Ready",
    queued: "Update queued",
    pulling: "Downloading image",
    draining: "Waiting for tasks and Bot nodes",
    "backing-up": "Backing up server data",
    installing: "Starting the new version",
    verifying: "Checking services",
    "rolling-back": "Restoring the previous version",
    succeeded: "Update completed",
    "rolled-back": "Previous version restored",
    failed: "Update stopped",
    "needs-attention": "Recovery needs attention",
    updated: "Settings saved",
    unknown: "Not checked yet",
  },
  "zh-CN": {
    current: "当前版本",
    available: "可用版本",
    check: "检查更新",
    install: "安装并重启",
    unavailable: "服务器更新器尚未连接，请参照服务器更新部署说明配置。",
    hint: "更新会短暂中断聊天。正在执行的任务先完成，安装前会备份服务器数据。",
    scope:
      "更新 Core、管理后台和内置聊天网页。中央账号服务与 Synapse 保持当前版本。",
    policy: "更新方式",
    manual: "手动检查",
    notify: "自动检查并提醒",
    auto: "维护时段内自动安装",
    channel: "发行渠道",
    stable: "稳定版",
    prerelease: "包含预发布版",
    start: "维护开始时间（小时）",
    end: "维护结束时间（小时）",
    zone: "时区",
    save: "保存更新设置",
    release: "版本说明",
    incompatible: "此版本需要单独迁移，或与当前服务器不兼容。",
    history: "更新历史",
    empty: "还没有执行过更新。",
    reconnect: "正在等待管理服务重新连接……",
    owner: "只有实例所有者可以修改或安装服务器更新。",
    backup: "已完成备份",
    recover: "重试恢复",
    idle: "准备就绪",
    queued: "更新已排队",
    pulling: "正在下载镜像",
    draining: "正在等待任务和 Bot 节点结束工作",
    "backing-up": "正在备份服务器数据",
    installing: "正在启动新版本",
    verifying: "正在检查服务",
    "rolling-back": "正在恢复原版本",
    succeeded: "更新完成",
    "rolled-back": "已恢复原版本",
    failed: "更新已停止",
    "needs-attention": "恢复需要处理",
    updated: "设置已保存",
    unknown: "尚未检查",
  },
} as const;
type Phase =
  | "queued"
  | "pulling"
  | "draining"
  | "backing-up"
  | "installing"
  | "verifying"
  | "rolling-back"
  | "succeeded"
  | "rolled-back"
  | "failed"
  | "needs-attention";
interface Job {
  id: string;
  phase: Phase;
  version: string;
  previousVersion: string;
  startedAt: number;
  error: string | null;
  backup: string;
}
interface Settings {
  policy: "manual" | "notify" | "auto";
  channel: "stable" | "prerelease";
  windowStart: number;
  windowEnd: number;
  timeZone: string;
}
interface Status {
  enabled: boolean;
  currentVersion: string | null;
  checkedAt: number | null;
  checkError: string | null;
  settings: Settings;
  available: { version: string; eligible: boolean; url: string } | null;
  job: Job | null;
  history: Job[];
}
const active = (job: Job | null) =>
  !!job &&
  !["succeeded", "rolled-back", "failed", "needs-attention"].includes(
    job.phase,
  );

export default function UpdatesPanel({ admin }: { admin: AdminState }) {
  const { api, locale, session } = admin;
  const t = useTranslation(messages);
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [saved, setSaved] = useState(false);
  const owner = session?.administrator.role === "owner";
  const load = useCallback(async () => {
    try {
      const next = await api<Status>("server-update");
      setStatus(next);
      setSettings((previous) => previous || next.settings);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [api]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [load]);
  async function perform(operation: string, input: unknown = {}) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await api<Status>(
        `server-update/${operation}`,
        "POST",
        input,
      );
      setStatus(next);
      setOffline(false);
      if (operation === "settings") {
        setSettings(next.settings);
        setSaved(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  if ((!status || !status.enabled) && !offline)
    return (
      <section className="admin-panel">
        <p>{status ? t("unavailable") : t("unknown")}</p>
      </section>
    );
  const running = active(status?.job || null);
  return (
    <div className="admin-update-panels">
      <section className="admin-panel">
        <h2>
          {t("current")}: {status?.currentVersion || t("unknown")}
        </h2>
        <p>{t("hint")}</p>
        <p>{t("scope")}</p>
        {!owner && <p className="admin-readonly-note">{t("owner")}</p>}
        {offline && <p role="status">{t("reconnect")}</p>}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        {status?.checkError && (
          <p className="admin-error" role="alert">
            {status.checkError}
          </p>
        )}
        {status?.available && (
          <div className="admin-update-release">
            <strong>
              {t("available")}: {status.available.version}
            </strong>{" "}
            <a href={status.available.url} target="_blank" rel="noreferrer">
              {t("release")}
            </a>
            {!status.available.eligible && <p>{t("incompatible")}</p>}
          </div>
        )}
        {status?.job && (
          <div
            role="status"
            aria-live="polite"
            className="admin-update-progress"
          >
            <strong>{t(status.job.phase)}</strong>
            <span>
              {status.job.previousVersion} → {status.job.version}
            </span>
            {status.job.backup === "complete" && <span>{t("backup")}</span>}
            {status.job.error && <p>{status.job.error}</p>}
          </div>
        )}
        {owner && (
          <div className="admin-actions">
            <Button
              variant="secondary"
              disabled={busy || running || offline}
              onClick={() => void perform("check")}
            >
              <RefreshCw size={16} />
              {t("check")}
            </Button>
            <Button
              disabled={
                busy ||
                running ||
                offline ||
                !status?.available?.eligible ||
                status.job?.phase === "needs-attention"
              }
              onClick={() =>
                void perform("apply", { version: status?.available?.version })
              }
            >
              <Download size={16} />
              {t("install")}
            </Button>
            {status?.job?.phase === "needs-attention" && (
              <Button
                variant="secondary"
                disabled={busy || offline}
                onClick={() => void perform("recover")}
              >
                {t("recover")}
              </Button>
            )}
          </div>
        )}
      </section>
      {settings && (
        <section className="admin-panel">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform("settings", settings);
            }}
          >
            <div className="admin-settings-grid">
              <Field label={t("policy")}>
                <Select<Settings["policy"]>
                  disabled={!owner || busy || running}
                  value={settings.policy}
                  onValueChange={(policy) =>
                    setSettings({ ...settings, policy })
                  }
                  options={(["manual", "notify", "auto"] as const).map(
                    (value) => ({
                      value,
                      label: t(value),
                    }),
                  )}
                />
              </Field>
              <Field label={t("channel")}>
                <Select<Settings["channel"]>
                  disabled={!owner || busy || running}
                  value={settings.channel}
                  onValueChange={(channel) =>
                    setSettings({ ...settings, channel })
                  }
                  options={[
                    { value: "stable", label: t("stable") },
                    { value: "prerelease", label: t("prerelease") },
                  ]}
                />
              </Field>
              {settings.policy === "auto" && (
                <>
                  <Field label={t("start")}>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      required
                      disabled={!owner || busy || running}
                      value={settings.windowStart}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          windowStart: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label={t("end")}>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      required
                      disabled={!owner || busy || running}
                      value={settings.windowEnd}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          windowEnd: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label={t("zone")}>
                    <Input
                      required
                      disabled={!owner || busy || running}
                      value={settings.timeZone}
                      onChange={(e) =>
                        setSettings({ ...settings, timeZone: e.target.value })
                      }
                    />
                  </Field>
                </>
              )}
            </div>
            {owner && (
              <Button
                type="submit"
                variant="secondary"
                disabled={busy || running || offline}
              >
                {t("save")}
              </Button>
            )}
            {saved && <p role="status">{t("updated")}</p>}
          </form>
        </section>
      )}
      <section className="admin-panel">
        <h2>{t("history")}</h2>
        {!status?.history.length && <p>{t("empty")}</p>}
        <ol className="admin-update-history">
          {status?.history.map((job) => (
            <li key={job.id}>
              <strong>{t(job.phase)}</strong> · {job.previousVersion} →{" "}
              {job.version}
              <br />
              <time dateTime={new Date(job.startedAt).toISOString()}>
                {new Date(job.startedAt).toLocaleString(locale)}
              </time>
              {job.error && <p>{job.error}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
