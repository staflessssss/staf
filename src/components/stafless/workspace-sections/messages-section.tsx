import { CircleAlert, Plus, Trash2 } from "lucide-react";

import {
  FormField,
  ToggleSwitch,
  inputClassName,
  selectClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import {
  ChannelBehaviorConfig,
  followUpOutOfHoursBehaviorOptions,
  followUpSendLimitOptions,
} from "@/lib/agent-builder";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

const sectionTitleClassName = "text-[18px] font-semibold tracking-[-0.02em] text-[#111827]";
const fieldCardClassName =
  "rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]";
const scheduleCardClassName =
  "rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]";
const mutedTextClassName = "text-sm leading-6 text-[#667085]";
const cardHeadingClassName = "text-base font-semibold text-[#111827]";
const dayTimeInputClassName =
  "w-full rounded-[10px] border border-[#dde3ee] bg-white px-3 py-2 text-center text-sm text-[#344054] outline-none transition focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/10 disabled:bg-[#f8fafc] disabled:text-[#98a2b3]";

function getSplitMessagesEnabled(channelBehavior: ChannelBehaviorConfig) {
  return channelBehavior.messageFormat === "split_into_2_3_messages";
}

function getBufferedRepliesEnabled(channelBehavior: ChannelBehaviorConfig) {
  return channelBehavior.bufferDelaySeconds > 0;
}

function getBufferedDelayValue(channelBehavior: ChannelBehaviorConfig) {
  return channelBehavior.bufferDelaySeconds > 0 ? channelBehavior.bufferDelaySeconds : 1;
}

export function WorkspaceMessagesSection({
  channelBehavior,
  isReadOnlyMode,
  onUpdateChannelBehavior,
}: {
  channelBehavior: ChannelBehaviorConfig;
  isReadOnlyMode: boolean;
  onUpdateChannelBehavior: (patch: Partial<ChannelBehaviorConfig>) => void;
}) {
  const splitMessagesEnabled = getSplitMessagesEnabled(channelBehavior);
  const bufferedRepliesEnabled = getBufferedRepliesEnabled(channelBehavior);
  const bufferDelayValue = getBufferedDelayValue(channelBehavior);

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-9">
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#e8edf5] pb-5">
          <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#101828]">
            Сообщения
          </h1>
          <button
            className="inline-flex items-center justify-center rounded-[10px] border border-[#d6ddeb] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-[#f8fafc]"
            type="button"
          >
            Тестовый чат
          </button>
        </div>

        <div className="space-y-3">
          <h2 className={sectionTitleClassName}>Отправка сообщений</h2>

          <div className={fieldCardClassName}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className={cardHeadingClassName}>Разделение сообщений</p>
                <p className={mutedTextClassName}>
                  Каждый абзац будет отправлен в отдельном сообщении
                </p>
              </div>
              <ToggleSwitch
                checked={splitMessagesEnabled}
                disabled={isReadOnlyMode}
                onCheckedChange={(checked) =>
                  onUpdateChannelBehavior({
                    messageFormat: checked ? "split_into_2_3_messages" : "single_message",
                  })
                }
              />
            </div>

            <div className="mt-4">
              <FormField label="Формат ответа">
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode}
                  onChange={(event) =>
                    onUpdateChannelBehavior({
                      messageFormat:
                        event.target.value as ChannelBehaviorConfig["messageFormat"],
                    })
                  }
                  value={channelBehavior.messageFormat}
                >
                  <option value="single_message">Одним сообщением</option>
                  <option value="split_into_2_3_messages">Разделять на 2-3 сообщения</option>
                </select>
              </FormField>
            </div>
          </div>

          <div className={fieldCardClassName}>
            <div className="space-y-1">
              <p className={cardHeadingClassName}>Буфер сообщений</p>
              <p className={mutedTextClassName}>
                Задержка отправки сообщений экономит токены и делает бота “человечнее”
              </p>
            </div>

            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <FormField label="Задержка в секундах">
                  <select
                    className={selectClassName}
                    disabled={isReadOnlyMode || !bufferedRepliesEnabled}
                    onChange={(event) =>
                      onUpdateChannelBehavior({
                        bufferDelaySeconds: Number(event.target.value || 0),
                      })
                    }
                    value={String(bufferDelayValue)}
                  >
                    {[1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="pt-8">
                <ToggleSwitch
                  checked={bufferedRepliesEnabled}
                  disabled={isReadOnlyMode}
                  onCheckedChange={(checked) =>
                    onUpdateChannelBehavior({
                      bufferDelaySeconds: checked ? bufferDelayValue : 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className={fieldCardClassName}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Длина ответа">
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode}
                  onChange={(event) =>
                    onUpdateChannelBehavior({
                      responseLength:
                        event.target.value as ChannelBehaviorConfig["responseLength"],
                    })
                  }
                  value={channelBehavior.responseLength}
                >
                  <option value="short">Короткий</option>
                  <option value="balanced">Сбалансированный</option>
                  <option value="detailed">Подробный</option>
                </select>
              </FormField>

              <FormField label="Тон и темп">
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode}
                  onChange={(event) =>
                    onUpdateChannelBehavior({
                      tonePace: event.target.value as ChannelBehaviorConfig["tonePace"],
                    })
                  }
                  value={channelBehavior.tonePace}
                >
                  <option value="warm">Тёплый</option>
                  <option value="professional">Профессиональный</option>
                  <option value="fast">Быстрый</option>
                  <option value="concise">Краткий</option>
                </select>
              </FormField>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField label="Призыв к действию">
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode}
                  onChange={(event) =>
                    onUpdateChannelBehavior({
                      ctaStyle: event.target.value as ChannelBehaviorConfig["ctaStyle"],
                    })
                  }
                  value={channelBehavior.ctaStyle}
                >
                  <option value="ask_a_question">Задавать вопрос</option>
                  <option value="offer_options">Предлагать варианты</option>
                  <option value="prompt_booking">Подталкивать к записи</option>
                </select>
              </FormField>

              <FormField label="Эмодзи">
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode}
                  onChange={(event) =>
                    onUpdateChannelBehavior({
                      emojiUsage: event.target.value as ChannelBehaviorConfig["emojiUsage"],
                    })
                  }
                  value={channelBehavior.emojiUsage}
                >
                  <option value="none">Не использовать</option>
                  <option value="limited">Ограниченно</option>
                  <option value="moderate">Умеренно</option>
                </select>
              </FormField>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-[12px] border border-[#e5e7eb] px-4 py-3">
                <span className="text-sm font-medium text-[#344054]">Подпись</span>
                <ToggleSwitch
                  checked={channelBehavior.useSignature}
                  disabled={isReadOnlyMode}
                  onCheckedChange={(checked) =>
                    onUpdateChannelBehavior({ useSignature: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-[12px] border border-[#e5e7eb] px-4 py-3">
                <span className="text-sm font-medium text-[#344054]">Форматирование</span>
                <ToggleSwitch
                  checked={channelBehavior.useRichFormatting}
                  disabled={isReadOnlyMode}
                  onCheckedChange={(checked) =>
                    onUpdateChannelBehavior({ useRichFormatting: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-[12px] border border-[#e5e7eb] px-4 py-3">
                <span className="text-sm font-medium text-[#344054]">Вложения</span>
                <ToggleSwitch
                  checked={channelBehavior.allowAttachments}
                  disabled={isReadOnlyMode}
                  onCheckedChange={(checked) =>
                    onUpdateChannelBehavior({ allowAttachments: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleClassName}>Follow-up сообщения</h2>

        <div className={fieldCardClassName}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className={cardHeadingClassName}>Отложенная отправка</p>
              <p className={mutedTextClassName}>
                AI-агент автоматически отправляет повторные сообщения при отсутствии ответа
              </p>
            </div>
            <ToggleSwitch
              checked={channelBehavior.followUpEnabled}
              disabled={isReadOnlyMode}
              onCheckedChange={(checked) =>
                onUpdateChannelBehavior({
                  followUpEnabled: checked,
                })
              }
            />
          </div>
        </div>

        {channelBehavior.followUpEnabled ? (
          <div className={fieldCardClassName}>
            <div className="space-y-4">
              {channelBehavior.followUpRules.map((rule, index) => (
                <div
                  key={`follow-up-rule-${index}`}
                  className="rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-4"
                >
                  <div className="grid gap-4 md:grid-cols-[80px_92px_92px_minmax(0,1fr)_36px]">
                    <FormField label="Дни">
                      <input
                        className={inputClassName}
                        disabled={isReadOnlyMode}
                        min={0}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    delayDays: Number(event.target.value || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                        type="number"
                        value={rule.delayDays}
                      />
                    </FormField>

                    <FormField label="Часы">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    delayHours: Number(event.target.value || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                        value={String(rule.delayHours).padStart(2, "0")}
                      >
                        {Array.from({ length: 24 }, (_, option) => String(option).padStart(2, "0")).map(
                          (option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ),
                        )}
                      </select>
                    </FormField>

                    <FormField label="Минуты">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    delayMinutes: Number(event.target.value || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                        value={String(rule.delayMinutes).padStart(2, "0")}
                      >
                        {["00", "05", "10", "15", "20", "30", "45", "55"].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Количество отправок">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    sendLimit:
                                      event.target.value as ChannelBehaviorConfig["followUpRules"][number]["sendLimit"],
                                  }
                                : item,
                            ),
                          })
                        }
                        value={rule.sendLimit}
                      >
                        {followUpSendLimitOptions.map((option) => (
                          <option key={option} value={option}>
                            {humanizeWorkspaceToken(option)}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="flex items-end">
                      <button
                        className="inline-flex size-9 items-center justify-center rounded-[10px] border border-[#e5e7eb] bg-white text-[#f04438] transition hover:bg-[#fff5f4] disabled:opacity-50"
                        disabled={isReadOnlyMode}
                        onClick={() =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }
                        type="button"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <FormField label="Поведение в нерабочее время">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    outOfHoursBehavior:
                                      event.target.value as ChannelBehaviorConfig["followUpRules"][number]["outOfHoursBehavior"],
                                  }
                                : item,
                            ),
                          })
                        }
                        value={rule.outOfHoursBehavior}
                      >
                        {followUpOutOfHoursBehaviorOptions.map((option) => (
                          <option key={option} value={option}>
                            {humanizeWorkspaceToken(option)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="mt-4">
                    <FormField label="Инструкция">
                      <textarea
                        className={textareaClassName}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    instruction: event.target.value,
                                  }
                                : item,
                            ),
                          })
                        }
                        placeholder="Введите инструкцию"
                        readOnly={isReadOnlyMode}
                        value={rule.instruction}
                      />
                    </FormField>
                  </div>
                </div>
              ))}

              <div className="flex justify-center">
                <button
                  className="inline-flex size-8 items-center justify-center rounded-full bg-[#6c63ff] text-white transition hover:bg-[#5b53ea] disabled:opacity-50"
                  disabled={isReadOnlyMode}
                  onClick={() =>
                    onUpdateChannelBehavior({
                      followUpRules: [
                        ...channelBehavior.followUpRules,
                        {
                          delayDays: 0,
                          delayHours: 4,
                          delayMinutes: 0,
                          sendLimit: "once_per_dialog",
                          outOfHoursBehavior: "send_immediately_ignore_schedule",
                          instruction: "",
                        },
                      ],
                    })
                  }
                  type="button"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className={scheduleCardClassName}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className={sectionTitleClassName}>Расписание</h2>
              <p className={mutedTextClassName}>
                Включите расписание, чтобы задать рабочие часы отправки сообщений
              </p>
            </div>
            <ToggleSwitch checked={false} disabled />
          </div>

          <div className="mt-5 rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-4">
            <p className="text-sm font-medium text-[#667085]">
              Интервал отправки: <span className="font-semibold text-[#6c63ff]">00:00 - 23:59</span>
            </p>

            <div className="mt-4 flex items-center gap-4">
              <input className={dayTimeInputClassName} disabled type="text" value="00:00" />
              <span className="text-[#667085]">–</span>
              <input className={dayTimeInputClassName} disabled type="text" value="23:59" />
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm text-[#98a2b3]">
              <input className="size-4" disabled type="checkbox" />
              <span>Отправлять сообщения в выходные</span>
            </label>
          </div>

          <div className="mt-4 rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-4">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#6c63ff]" />
              <p className="text-sm leading-6 text-[#667085]">
                Отложенные сообщения отправляются только в указанный интервал (00:00–23:59,
                Asia/Almaty). Если время попадает на нерабочие часы, сообщение будет отправлено в
                начале следующего интервала.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className={fieldCardClassName}>
          <FormField label="Внутренние заметки">
            <textarea
              className={textareaClassName}
              onChange={(event) => onUpdateChannelBehavior({ notes: event.target.value })}
              placeholder="Например: для Instagram держать ответы короткими и разбивать длинные сообщения."
              readOnly={isReadOnlyMode}
              value={channelBehavior.notes ?? ""}
            />
          </FormField>
        </div>
      </section>

    </div>
  );
}
