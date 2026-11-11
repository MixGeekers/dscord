import { Button, Input } from "../../../ui/controls";
import { Select } from "../../../ui/select";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { messageOf } from "../api";
import { formatDateTime } from "../../i18n.js";
import { useTranslation } from "../locale";
import { kernelMessages } from "../locales/kernel";
import type {
  MemoryClaim,
  MemoryProfile,
  MemoryProfileItem,
  MemoryProfileKind,
  MemorySource,
} from "../bot-kernel";
import type { Api, Participant, Room } from "../types";
import { Icon } from "./Icons";
import { Loading } from "../../../ui/loading";
import { Field, FieldRow } from "../../../ui/form";
import { EmptyState, FilterChips, Section } from "../../../ui/layout";

export function BotMemory({
  bot,
  api,
  rooms,
  participants,
}: {
  bot: Participant;
  api: Api;
  rooms: Room[];
  participants: Participant[];
}) {
  const t = useTranslation(kernelMessages);
  const [kind, setKind] = useState<MemoryProfileKind>("person");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [roomId, setRoomId] = useState("");
  const [items, setItems] = useState<MemoryProfileItem[]>([]);
  const [profileId, setProfileId] = useState("");
  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const route = `/api/bots/${encodeURIComponent(bot.id)}/memory/profile`;
  const availableRooms = rooms.filter((room) =>
    room.participantIds.includes(bot.id),
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ kind });
    if (roomId) params.set("roomId", roomId);
    if (search) params.set("query", search);
    if (profileId) params.set("id", profileId);
    setLoading(true);
    setError("");
    setProfile(null);
    if (!profileId) setItems([]);
    void api<
      | MemoryProfile
      | { kind: MemoryProfileKind; items: MemoryProfileItem[]; more: boolean }
    >(`${route}?${params}`, { signal: controller.signal, timeout: 20000 })
      .then((result) => {
        if (controller.signal.aborted) return;
        if ("items" in result) {
          if (!Array.isArray(result.items))
            throw new Error("Invalid memory profile list");
          setItems(result.items);
          setMore(result.more === true);
        } else {
          if (!result.view || result.id !== profileId || result.kind !== kind)
            throw new Error("Invalid memory profile receipt");
          setProfile(result);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(messageOf(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, route, kind, roomId, search, profileId, revision]);

  // Results follow the search box as the person types.
  useEffect(() => {
    const next = query.trim();
    if (next === search) return;
    const timer = window.setTimeout(() => {
      setProfileId("");
      setSearch(next);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setProfileId("");
    setSearch(query.trim());
    setRevision((value) => value + 1);
  }
  const person = (id: string) =>
    participants.find((member) => member.id === id)?.name ?? id;
  const scopeName = (scope?: string) => {
    if (scope === "own") return t("ownScope");
    if (scope === "team") return t("teamScope");
    if (scope?.startsWith("room:")) {
      const id = scope.slice(5);
      return (
        rooms.find((room) => room.roomId === id)?.name ?? t("roomScope", { id })
      );
    }
    return scope ?? t("unknown");
  };
  function sources(list: MemorySource[]) {
    return list.map((source) => (
      <li key={`${source.id}/${source.revision ?? ""}`}>
        {source.authorId && (
          <strong>{t("by", { name: person(source.authorId) })}</strong>
        )}
        {source.timestamp != null && (
          <time dateTime={new Date(source.timestamp).toISOString()}>
            {formatDateTime(source.timestamp)}
          </time>
        )}
        {source.roomId && (
          <span>
            {rooms.find((room) => room.roomId === source.roomId)?.name ??
              source.roomId}
          </span>
        )}
        <small>
          {source.eventId ?? source.id}
          {source.revision != null ? ` · r${source.revision}` : ""}
        </small>
      </li>
    ));
  }
  function claim(entry: MemoryClaim) {
    const state = entry.claimState;
    const origin = entry.kind;
    return (
      <article
        className="bot-memory-claim"
        key={`${entry.id}/${entry.revision ?? ""}`}
        data-memory-record={entry.id}
      >
        <div className="bot-memory-labels">
          {state &&
            ["statement", "proposal", "confirmed", "uncertain"].includes(
              state,
            ) && <span>{t(state)}</span>}
          {origin &&
            [
              "stated",
              "reported",
              "observation",
              "inference",
              "legacy",
            ].includes(origin) && <span>{t(origin)}</span>}
        </div>
        <p className="bot-memory-text">{entry.text}</p>
        {entry.saidBy && (
          <p className="muted">{t("by", { name: person(entry.saidBy) })}</p>
        )}
        <p className="muted">
          {t("scopeLabel", { scope: scopeName(entry.scope) })}
        </p>
        {!!entry.conflicts?.length && (
          <p className="bot-memory-conflict">
            <Icon name="info" />
            {t("conflict", { count: entry.conflicts.length })}
          </p>
        )}
        <details className="bot-memory-sources">
          <summary>
            {t("sources")} ·{" "}
            {entry.sources?.length ?? entry.sourceRefs?.length ?? 0}
          </summary>
          {entry.sources?.length ? (
            <ul>{sources(entry.sources)}</ul>
          ) : (
            <>
              <p className="muted">{t("sourceMissing")}</p>
              {entry.sourceRefs?.map((ref) => (
                <small
                  className="member-full-id"
                  key={`${ref.id}/${ref.revision ?? ""}`}
                >
                  {ref.id}
                  {ref.revision != null ? ` · r${ref.revision}` : ""}
                </small>
              ))}
            </>
          )}
          {!!entry.conflicts?.length && (
            <p className="muted">{entry.conflicts.join(" · ")}</p>
          )}
          <small className="member-full-id">
            {t("record", { id: entry.id })}
          </small>
        </details>
      </article>
    );
  }
  const groups = profile
    ? ([
        ["facts", profile.view.currentClaims],
        ["preferences", profile.view.preferences],
        ["projectFacts", profile.view.projectFacts],
        ["changes", profile.view.changes],
      ] as const)
    : [];
  const entity = (item: MemoryProfileItem) => (
    <Button
      key={item.id}
      variant="ghost"
      className="bot-memory-entity"
      type="button"
      data-memory-profile={item.id}
      onClick={() => setProfileId(item.id)}
    >
      <Icon name={kind === "person" ? "user" : "folder"} />
      <span>
        <strong>{item.name || item.id}</strong>
        <small>{item.id}</small>
      </span>
      {!!item.currentCount && (
        <small className="bot-memory-count">
          {t("currentRecords", { count: item.currentCount })}
        </small>
      )}
    </Button>
  );
  // People and projects with nothing current are kept apart, so the list shows where there is something to read.
  const filled = items.filter((item) => item.currentCount !== 0);
  const empty = items.filter((item) => item.currentCount === 0);
  return (
    <Section
      className="bot-memory"
      data-bot-memory={bot.id}
      title={t("memoryTitle", { name: bot.name })}
      description={`${t("memoryHelp", { name: bot.name })} ${t("memoryBoundary")}`}
    >
      <form className="bot-memory-filter" onSubmit={submit}>
        <FilterChips<MemoryProfileKind>
          aria-label={t("kind")}
          value={kind}
          onValueChange={(next) => {
            setKind(next);
            setProfileId("");
          }}
          chips={[
            { value: "person", label: t("people") },
            { value: "project", label: t("projects") },
          ]}
        />
        <FieldRow>
          <Field label={t("scope")} htmlFor="bot-memory-room">
            <Select
              id="bot-memory-room"
              value={roomId}
              onValueChange={(next) => {
                setRoomId(next);
                setProfileId("");
              }}
              options={[
                { value: "", label: t("allScopes") },
                ...availableRooms.map((room) => ({
                  value: room.roomId,
                  label: room.name,
                })),
              ]}
            />
          </Field>
          <Field label={t("search")} htmlFor="bot-memory-query">
            <Input
              id="bot-memory-query"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </Field>
        </FieldRow>
      </form>
      {loading && <Loading label={t("loadingMemory")} />}
      {error && <p role="alert">{t("memoryFailed", { error })}</p>}
      {!!error && (
        <Button
          variant="secondary"
          type="button"
          onClick={() => setRevision((value) => value + 1)}
        >
          {t("refresh")}
        </Button>
      )}
      {!loading && !error && !profileId && (
        <div className="bot-memory-entities">
          {!items.length && <EmptyState compact title={t("noEntities")} />}
          {filled.length > 0 && (
            <div className="bot-memory-entity-list">{filled.map(entity)}</div>
          )}
          {empty.length > 0 && (
            <details
              className="bot-memory-empty-entities"
              open={!filled.length}
            >
              <summary>{t("emptyEntities", { count: empty.length })}</summary>
              <div className="bot-memory-entity-list">{empty.map(entity)}</div>
            </details>
          )}
          {more && <p className="muted">{t("more")}</p>}
        </div>
      )}
      {!!profileId && (
        <Button
          variant="ghost"
          type="button"
          className="bot-memory-back"
          onClick={() => setProfileId("")}
        >
          <Icon name="back" />
          {t(kind === "person" ? "people" : "projects")}
        </Button>
      )}
      {!loading && profile && (
        <div className="bot-memory-profile">
          <h3>{profile.identity.name || profile.id}</h3>
          <small className="member-full-id">{profile.id}</small>
          {groups.every(([, entries]) => !entries?.length) && (
            <p>{t("noClaims")}</p>
          )}
          {groups.map(
            ([key, entries]) =>
              !!entries?.length && (
                <section key={key}>
                  <h4>{t(key)}</h4>
                  {key === "changes" && (
                    <p className="muted">{t("historicalHelp")}</p>
                  )}
                  {entries.map(claim)}
                </section>
              ),
          )}
          {!!profile.view.recentSources?.length && (
            <details className="bot-memory-sources">
              <summary>{t("sources")}</summary>
              <ul>{sources(profile.view.recentSources)}</ul>
            </details>
          )}
          {!!profile.view.historyGaps?.length && (
            <p className="bot-memory-conflict">{t("gaps")}</p>
          )}
          {Object.values(profile.view.budget?.omitted ?? {}).some(
            (count) => count > 0,
          ) && <p className="muted">{t("shortened")}</p>}
        </div>
      )}
    </Section>
  );
}
