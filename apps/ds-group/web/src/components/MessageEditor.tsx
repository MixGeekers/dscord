import { useEffect, useRef, useState } from "react";
import { createMentionEditor } from "../../mention-editor.js";
import type { MentionEditor, MentionValue } from "../../mention-editor.js";
import { useTranslation } from "../locale";
import { chatMessages } from "../locales/chat";
import type { Mentionables } from "../types";

export interface MessageEditorProps {
  body: string;
  mentionables: Mentionables;
  onSave(value: MentionValue): Promise<boolean>;
  onCancel(): void;
}

/** Edits one sent message in place, with the same mention editing as the composer. */
export function MessageEditor(props: MessageEditorProps) {
  const t = useTranslation(chatMessages);
  const inputRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MentionEditor | null>(null);
  const latest = useRef({ props, t });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    latest.current = { props, t };
  });

  async function save() {
    const editor = editorRef.current;
    if (!editor || savingRef.current) return;
    const value = editor.getValue();
    const { props: current } = latest.current;
    if (!value.body.trim()) return;
    if (value.body === current.body) {
      current.onCancel();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    editor.setDisabled(true);
    const saved = await current.onSave(value);
    savingRef.current = false;
    if (saved) {
      latest.current.props.onCancel();
      return;
    }
    setSaving(false);
    editor.setDisabled(false);
    editor.focus();
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const element = inputRef.current;
    const popup = popupRef.current;
    if (!element || !popup) return;
    const label = (key: Parameters<typeof t>[0], values = {}) =>
      latest.current.t(key, values);
    const editor = createMentionEditor({
      element,
      popup,
      getMentionables: () => latest.current.props.mentionables,
      getLabels: () => ({
        suggestions: label("mentionList"),
        mention: label("mentionNamed", { name: "{name}" }),
        role: label("role"),
        everyone: label("everyone"),
        here: label("here"),
        online: label("online"),
        offline: label("offline"),
      }),
      onSubmit() {
        void saveRef.current();
      },
    });
    editorRef.current = editor;
    editor.setValue(latest.current.props.body);
    editor.setDisabled(false);
    editor.focus();
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  return (
    <div
      className="message-editor"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !savingRef.current) {
          event.preventDefault();
          latest.current.props.onCancel();
        }
      }}
    >
      <div className="composer-box message-editor-box">
        <div className="mention-popup" ref={popupRef} hidden />
        <div
          ref={inputRef}
          className="message-input"
          contentEditable={false}
          suppressContentEditableWarning
          spellCheck
          aria-label={t("editMessage")}
        />
      </div>
      <div className="message-editor-actions">
        <span>{t("editHint")}</span>
        <button
          type="button"
          className="message-editor-button"
          onClick={() => props.onCancel()}
          disabled={saving}
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          className="message-editor-button primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
