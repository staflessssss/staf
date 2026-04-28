import { Expand, Sparkles } from "lucide-react";

import {
  FormField,
  inputClassName,
  textareaClassName,
} from "@/components/stafless/foundation";

const rowClassName = "rounded-[16px] border border-[#e6ebf2] bg-white px-4 py-4";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[#d7def0] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-[#f8fafc]";
const accentButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-[#6c63ff] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#5b52f5]";

export function WorkspacePromptingSection({
  tone,
  languagePreference,
  persona,
  promptingInstruction,
  promptingNotes,
  showContactIdentity,
  showChannelContext,
  onToneChange,
  onLanguageChange,
  onPersonaChange,
  onPromptingInstructionChange,
  onPromptingNotesChange,
  onShowContactIdentityChange,
  onShowChannelContextChange,
}: {
  tone: string;
  languagePreference: string;
  persona: string;
  promptingInstruction: string;
  promptingNotes: string;
  showContactIdentity: boolean;
  showChannelContext: boolean;
  onToneChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onPersonaChange: (value: string) => void;
  onPromptingInstructionChange: (value: string) => void;
  onPromptingNotesChange: (value: string) => void;
  onShowContactIdentityChange: (value: boolean) => void;
  onShowChannelContextChange: (value: boolean) => void;
}) {
  return (
    <div className="mx-auto max-w-[1040px] space-y-8">
      <section className="space-y-6">
        <div className="border-b border-[#edf1f6] pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-foreground">
                Prompting
              </h2>
              <p className="max-w-[700px] text-sm leading-6 text-muted-foreground">
                Define the core instruction layer and what runtime context the
                model is allowed to see.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <FormField
            label="Instruction"
            hint="Explain who the agent is, how it should speak, and what matters most in the dialog."
          >
            <div className="relative">
              <textarea
                className={`${textareaClassName} min-h-[170px] resize-none pr-12 pb-12`}
                onChange={(event) => onPromptingInstructionChange(event.target.value)}
                placeholder="For example: You are the operator-facing AI assistant for this business. Reply briefly, clearly, and professionally. Identify the customer's need, keep the conversation moving, and never invent confirmed actions."
                value={promptingInstruction}
              />
              <button
                aria-label="Expand instruction"
                className="absolute bottom-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#d7def0] bg-white text-[#667085] transition hover:bg-[#f8fafc]"
                type="button"
              >
                <Expand className="size-3.5" />
              </button>
            </div>
          </FormField>

          <div className="flex flex-wrap gap-3">
            <button className={accentButtonClassName} type="button">
              <Sparkles className="size-4" />
              AI polish
            </button>
            <button className={secondaryButtonClassName} type="button">
              Edit agent
            </button>
          </div>

          <div>
            <a
              className="text-sm font-medium text-[#6c63ff] underline underline-offset-4 transition hover:text-[#5b52f5]"
              href="#"
            >
              Prompt templates
            </a>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-[20px] border border-[#e6ebf2] bg-[#fbfcfe] p-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Contact identity visibility
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Show the contact number or nickname to the model when it helps
                  personalize replies.
                </p>
              </div>
              <input
                checked={showContactIdentity}
                className="mt-1 h-5 w-5 rounded border-border"
                onChange={(event) => onShowContactIdentityChange(event.target.checked)}
                type="checkbox"
              />
            </div>

            <hr className="border-[#edf1f6]" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Messenger visibility
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Show the active channel to the model so it can adapt phrasing
                  to the conversation surface.
                </p>
              </div>
              <input
                checked={showChannelContext}
                className="mt-1 h-5 w-5 rounded border-border"
                onChange={(event) => onShowChannelContextChange(event.target.checked)}
                type="checkbox"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5 border-t border-[#edf1f6] pt-6">
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Tone">
            <input
              className={inputClassName}
              onChange={(event) => onToneChange(event.target.value)}
              value={tone}
            />
          </FormField>
          <FormField
            label="Preferred response language"
            hint="Optional. Leave blank to keep the agent multilingual-first."
          >
            <input
              className={inputClassName}
              onChange={(event) => onLanguageChange(event.target.value)}
              placeholder="For example: Russian, English, Spanish"
              value={languagePreference}
            />
          </FormField>
        </div>

        <FormField
          label="Persona"
          hint="Describe the role the agent should consistently inhabit."
        >
          <textarea
            className={textareaClassName}
            onChange={(event) => onPersonaChange(event.target.value)}
            value={persona}
          />
        </FormField>

        <div className={rowClassName}>
          <FormField
            label="Operator notes"
            hint="Optional. Keep private notes here if the operator wants extra prompt-layer guidance without changing playbook logic."
          >
            <textarea
              className={textareaClassName}
              onChange={(event) => onPromptingNotesChange(event.target.value)}
              placeholder="For example: Prefer short factual answers with premium polish. If the customer sounds rushed, move straight to the next useful action."
              value={promptingNotes}
            />
          </FormField>
        </div>
      </section>
    </div>
  );
}
