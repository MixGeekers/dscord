// The component showcase: every component of the design system on one page, in either language and theme.
// Open with `npm run showcase`; `?lang=en&theme=light` picks the starting language and theme.
import { Copy, MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Textarea,
} from "../controls";
import { Choice, Field, FieldGroup, FieldRow, fieldDescribedBy } from "../form";
import {
  EmptyState,
  FilterChips,
  InfoList,
  ScrollArea,
  Section,
} from "../layout";
import { Select } from "../select";
import {
  showcaseMessages,
  type ShowcaseKey,
  type ShowcaseLocale,
} from "./messages";

type Theme = "light" | "dark";

const roles = [
  ["display", "roleDisplay"],
  ["title", "roleTitle"],
  ["heading", "roleHeading"],
  ["message", "roleMessage"],
  ["body-strong", "roleBodyStrong"],
  ["body", "roleBody"],
  ["label", "roleLabel"],
  ["caption", "roleCaption"],
  ["micro", "roleMicro"],
  ["code", "roleCode"],
] as const satisfies readonly (readonly [string, ShowcaseKey])[];

const swatches = ["indigo", "blue", "teal", "rose", "amber"] as const;

export function Showcase({
  initialLocale,
  initialTheme,
}: {
  initialLocale: ShowcaseLocale;
  initialTheme: Theme;
}) {
  const [locale, setLocale] = useState<ShowcaseLocale>(initialLocale);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [contact, setContact] = useState("all");
  const [accent, setAccent] = useState<(typeof swatches)[number]>("indigo");
  const t = (key: ShowcaseKey, values: Record<string, string> = {}) =>
    showcaseMessages[locale][key].replace(
      /\{(\w+)\}/g,
      (_, name: string) => values[name] ?? "",
    );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    document.title = t("title");
  });

  return (
    <div className="showcase">
      <header className="showcase-header">
        <div className="showcase-heading">
          <h1 className="ds-text-title">{t("title")}</h1>
          <p className="ds-text-caption">{t("subtitle")}</p>
        </div>
        <div className="showcase-switches">
          <FilterChips<ShowcaseLocale>
            aria-label={t("language")}
            value={locale}
            onValueChange={setLocale}
            chips={[
              { value: "zh-CN", label: "中文" },
              { value: "en", label: "English" },
            ]}
          />
          <FilterChips<Theme>
            aria-label={t("theme")}
            value={theme}
            onValueChange={setTheme}
            chips={[
              { value: "light", label: t("light") },
              { value: "dark", label: t("dark") },
            ]}
          />
        </div>
      </header>

      <main className="showcase-grid">
        <article className="showcase-card showcase-wide" id="text-roles">
          <Section
            as="h2"
            title={t("textRoles")}
            description={t("textRolesHelp")}
          >
            <dl className="showcase-roles">
              {roles.map(([role, key]) => (
                <div className="showcase-role" key={role}>
                  <dt className="ds-text-caption">
                    {t(key)} ·{" "}
                    <code className="ds-text-code">--text-{role}</code>
                  </dt>
                  <dd className={`showcase-role-sample showcase-role-${role}`}>
                    {t("sampleText")}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        </article>

        <article className="showcase-card" id="buttons">
          <Section as="h2" title={t("buttons")} description={t("buttonsHelp")}>
            <div className="showcase-row">
              <Button>{t("primary")}</Button>
              <Button variant="secondary">{t("secondary")}</Button>
              <Button variant="ghost">{t("ghost")}</Button>
              <Button variant="destructive">{t("destructive")}</Button>
            </div>
            <div className="showcase-row">
              <Button size="sm">{t("small")}</Button>
              <Button size="sm" variant="secondary">
                {t("small")}
              </Button>
              <Button disabled>{t("disabled")}</Button>
              <Button size="icon" variant="ghost" aria-label={t("copy")}>
                <Copy aria-hidden="true" />
              </Button>
            </div>
          </Section>
        </article>

        <article className="showcase-card" id="fields">
          <Section as="h2" title={t("fields")} description={t("fieldsHelp")}>
            <FieldGroup>
              <Field
                label={t("botName")}
                htmlFor="showcase-bot-name"
                description={t("botNameHelp")}
              >
                <Input
                  id="showcase-bot-name"
                  defaultValue="Devtomato"
                  aria-describedby={fieldDescribedBy("showcase-bot-name", {
                    description: t("botNameHelp"),
                  })}
                />
              </Field>
              <Field
                label={t("role")}
                htmlFor="showcase-role"
                optional={t("optional")}
              >
                <Textarea
                  id="showcase-role"
                  rows={2}
                  placeholder={t("rolePlaceholder")}
                />
              </Field>
              <FieldRow>
                <Field
                  label={t("deviceName")}
                  htmlFor="showcase-device"
                  error={t("deviceNameError")}
                >
                  <Input
                    id="showcase-device"
                    aria-invalid="true"
                    aria-describedby={fieldDescribedBy("showcase-device", {
                      error: t("deviceNameError"),
                    })}
                  />
                </Field>
                <Field label={t("language2")} htmlFor="showcase-language">
                  <Select
                    id="showcase-language"
                    defaultValue="system"
                    options={[
                      { value: "system", label: t("system") },
                      { value: "zh-CN", label: "简体中文" },
                      { value: "en", label: "English" },
                    ]}
                  />
                </Field>
              </FieldRow>
            </FieldGroup>
          </Section>
        </article>

        <article className="showcase-card" id="select">
          <Section as="h2" title={t("select")} description={t("selectHelp")}>
            <Field label={t("model")} htmlFor="showcase-model">
              <Select
                id="showcase-model"
                defaultValue="deepseek-reasoner"
                options={[
                  { value: "", label: t("modelDefault") },
                  {
                    value: "deepseek-chat",
                    label: "DeepSeek Chat",
                    group: "DeepSeek",
                  },
                  {
                    value: "deepseek-reasoner",
                    label: "DeepSeek Reasoner",
                    group: "DeepSeek",
                  },
                  {
                    value: "clef",
                    label: t("modelNeedsKey", { name: "Clef" }),
                    description: "Cloudflare Workers AI",
                    group: "Cloudflare",
                  },
                  {
                    value: "clef-flash",
                    label: "Clef Flash",
                    group: "Cloudflare",
                    disabled: true,
                  },
                ]}
              />
            </Field>
          </Section>
        </article>

        <article className="showcase-card" id="choices">
          <Section as="h2" title={t("choices")} description={t("choicesHelp")}>
            <RadioGroup
              name="showcase-notify"
              defaultValue="mentions"
              className="showcase-stack"
            >
              <Choice
                control={<Radio value="mentions" />}
                label={t("notifyMentions")}
                description={t("notifyMentionsHelp")}
              />
              <Choice
                control={<Radio value="all" />}
                label={t("notifyAll")}
                description={t("notifyAllHelp")}
              />
            </RadioGroup>
            <Choice control={<Checkbox defaultChecked />} label={t("pushOn")} />
          </Section>
        </article>

        <article className="showcase-card showcase-wide" id="sections">
          <Section
            as="h2"
            title={t("sections")}
            description={t("sectionsHelp")}
          >
            <div className="showcase-panel">
              <Section
                title={t("identity")}
                description={t("identityHelp")}
                actions={
                  <Button size="sm" variant="secondary">
                    {t("edit")}
                  </Button>
                }
              >
                <InfoList
                  items={[
                    {
                      label: t("userId"),
                      value: "francisco",
                      code: true,
                      action: <CopyButton label={t("copy")} />,
                    },
                    {
                      label: t("globalId"),
                      value: "francisco@central.dscord.example",
                      code: true,
                      action: <CopyButton label={t("copy")} />,
                    },
                    { label: t("central"), value: "central.dscord.example" },
                    {
                      label: t("homeServer"),
                      value: "Echoo Studio · chat.echoo.example",
                    },
                    {
                      label: t("matrixId"),
                      value: "@francisco:chat.echoo.example",
                      code: true,
                    },
                  ]}
                />
              </Section>
              <Section title={t("notifications")}>
                <Choice
                  control={<Checkbox defaultChecked />}
                  label={t("pushOn")}
                />
              </Section>
            </div>
          </Section>
        </article>

        <article className="showcase-card" id="filters">
          <Section as="h2" title={t("filters")} description={t("filtersHelp")}>
            <FilterChips
              aria-label={t("conversations")}
              value={contact}
              onValueChange={setContact}
              chips={[
                { value: "all", label: t("all"), count: 12 },
                {
                  value: "devtomato",
                  label: "Devtomato",
                  count: 8,
                  leading: <span className="showcase-dot" />,
                },
                {
                  value: "helper",
                  label: locale === "zh-CN" ? "小助手" : "Helper",
                  count: 4,
                },
                { value: "muted", label: "Ops", disabled: true },
              ]}
            />
          </Section>
        </article>

        <article className="showcase-card" id="empty">
          <Section as="h2" title={t("empty")} description={t("emptyHelp")}>
            <div className="showcase-panel">
              <EmptyState
                icon={<MessagesSquare />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={
                  <Button size="sm" variant="secondary">
                    {t("emptyAction")}
                  </Button>
                }
              />
            </div>
          </Section>
        </article>

        <article className="showcase-card showcase-wide" id="scroll">
          <Section as="h2" title={t("scroll")} description={t("scrollHelp")}>
            <ScrollArea
              className="showcase-scroll"
              data-testid="showcase-scroll"
            >
              <FieldGroup>
                <fieldset className="ds-field">
                  <legend className="ds-field-label">{t("themeColor")}</legend>
                  <div
                    className="showcase-swatches"
                    role="radiogroup"
                    aria-label={t("themeColor")}
                  >
                    {swatches.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        role="radio"
                        aria-checked={accent === swatch}
                        aria-label={swatch}
                        className={`showcase-swatch showcase-swatch-${swatch}`}
                        onClick={() => setAccent(swatch)}
                      />
                    ))}
                  </div>
                </fieldset>
                <Field label={t("deviceName")} htmlFor="showcase-scroll-device">
                  <Input
                    id="showcase-scroll-device"
                    defaultValue={t("deviceNameValue")}
                  />
                </Field>
                {Array.from({ length: 4 }, (_, index) => (
                  <Choice
                    key={index}
                    control={<Checkbox defaultChecked={index % 2 === 0} />}
                    label={`${t("notifyAll")} ${index + 1}`}
                    description={t("notifyAllHelp")}
                  />
                ))}
              </FieldGroup>
            </ScrollArea>
          </Section>
        </article>
      </main>
    </div>
  );
}

function CopyButton({ label }: { label: string }) {
  return (
    <Button size="sm" variant="ghost" aria-label={label}>
      <Copy aria-hidden="true" />
    </Button>
  );
}
