import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Trash2 } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import {
  importDictionary,
  normalizeDictionary,
} from "../../lib/utils/textDictionary";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SettingContainer } from "../ui/SettingContainer";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import type { TextReplacement } from "@/bindings";

export const TextDictionary: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const entries = getSetting("text_replacements") ?? [];
  const enabled = getSetting("text_replacements_enabled") ?? true;
  const busy = isUpdating("text_replacements");

  const save = async (next: TextReplacement[]) => {
    await updateSetting("text_replacements", next);
    if (
      JSON.stringify(getSetting("text_replacements")) !== JSON.stringify(next)
    ) {
      throw new Error("saveFailed");
    }
    setError("");
  };

  const showError = (cause: unknown) => {
    const code =
      cause instanceof SyntaxError
        ? "invalidEntry"
        : cause instanceof Error
          ? cause.message
          : "";
    const known = ["invalidEntry", "duplicate", "tooManyEntries"].includes(
      code,
    );
    setError(
      t("settings.textDictionary.errors." + (known ? code : "saveFailed")),
    );
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await save(normalizeDictionary([...entries, { from, to }]));
      setFrom("");
      setTo("");
    } catch (cause) {
      showError(cause);
    }
  };

  const remove = async (recognized: string) => {
    try {
      await save(entries.filter((entry) => entry.from !== recognized));
    } catch (cause) {
      showError(cause);
    }
  };

  const readImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await save(importDictionary(await file.text(), entries));
    } catch (cause) {
      showError(cause);
    }
  };

  return (
    <>
      <ToggleSwitch
        checked={enabled}
        disabled={busy}
        onChange={(next) => updateSetting("text_replacements_enabled", next)}
        isUpdating={isUpdating("text_replacements_enabled")}
        label={t("settings.textDictionary.enabled")}
        description={t("settings.textDictionary.enabledDescription")}
        descriptionMode="inline"
        grouped
      />
      <SettingContainer
        title={t("settings.textDictionary.title")}
        description={t("settings.textDictionary.description")}
        descriptionMode="inline"
        layout="stacked"
        grouped
      >
        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-mid-gray">
              <span>{t("settings.textDictionary.from")}</span>
              <Input
                className="w-full min-h-[40px] text-text"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                placeholder={t("settings.textDictionary.fromPlaceholder")}
                maxLength={64}
                disabled={busy}
              />
            </label>
            <label className="space-y-1 text-xs text-mid-gray">
              <span>{t("settings.textDictionary.to")}</span>
              <Input
                className="w-full min-h-[40px] text-text"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder={t("settings.textDictionary.toPlaceholder")}
                maxLength={64}
                disabled={busy}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              className="min-h-[40px]"
              disabled={busy || !from.trim() || !to.trim()}
            >
              {t("settings.textDictionary.add")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[40px]"
              disabled={busy}
              onClick={() => importInput.current?.click()}
            >
              {t("settings.textDictionary.import")}
            </Button>
            <input
              ref={importInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={readImport}
              aria-label={t("settings.textDictionary.import")}
            />
          </div>
          <p className="text-xs text-mid-gray">
            {t("settings.textDictionary.importDescription")}
          </p>
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </form>
        <div className="mt-4 space-y-1">
          {entries.length === 0 && (
            <p className="text-sm text-mid-gray py-3">
              {t("settings.textDictionary.empty")}
            </p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.from}
              className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_40px] items-center gap-2 min-h-[40px]"
            >
              <span className="text-sm break-words">{entry.from}</span>
              <ArrowRight
                className="w-4 h-4 text-mid-gray"
                aria-hidden="true"
              />
              <span className="text-sm font-medium break-words">
                {entry.to}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-[40px] w-[40px] flex items-center justify-center"
                disabled={busy}
                onClick={() => remove(entry.from)}
                aria-label={t("settings.textDictionary.remove", {
                  word: entry.from,
                })}
              >
                <Trash2
                  className="w-4 h-4 shrink-0 text-mid-gray"
                  aria-hidden="true"
                />
              </Button>
            </div>
          ))}
        </div>
      </SettingContainer>
    </>
  );
};
