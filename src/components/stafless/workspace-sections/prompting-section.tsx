import {
  FormField,
  ToggleSwitch,
  inputClassName,
  textareaClassName,
} from "@/components/stafless/foundation";

const rowClassName = "rounded-[16px] border border-[#e6ebf2] bg-white px-4 py-4";

export function WorkspacePromptingSection({
  isReadOnlyMode,
  tone,
  persona,
  promptingInstruction,
  promptingNotes,
  preserveModelVoice = false,
  onToneChange,
  onPersonaChange,
  onPromptingInstructionChange,
  onPromptingNotesChange,
  onPreserveModelVoiceChange,
}: {
  isReadOnlyMode: boolean;
  tone: string;
  persona: string;
  promptingInstruction: string;
  promptingNotes: string;
  preserveModelVoice?: boolean;
  onToneChange: (value: string) => void;
  onPersonaChange: (value: string) => void;
  onPromptingInstructionChange: (value: string) => void;
  onPromptingNotesChange: (value: string) => void;
  onPreserveModelVoiceChange?: (value: boolean) => void;
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
                Define the agent&apos;s behavior, voice, and core instruction layer.
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
                readOnly={isReadOnlyMode}
                value={promptingInstruction}
              />
            </div>
          </FormField>
        </div>

        <div className={rowClassName}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827]">Voice-first conversation</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Keep the model led by this voice, knowledge, and actions. Turn this off only when
                this agent should also follow the structured Playbook settings.
              </p>
            </div>
            <ToggleSwitch
              checked={preserveModelVoice}
              disabled={isReadOnlyMode}
              onCheckedChange={(checked) => onPreserveModelVoiceChange?.(checked)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-5 border-t border-[#edf1f6] pt-6">
        <FormField
          label="Persona"
          hint="Describe the role the agent should consistently inhabit."
        >
          <textarea
            className={textareaClassName}
            onChange={(event) => onPersonaChange(event.target.value)}
            readOnly={isReadOnlyMode}
            value={persona}
          />
        </FormField>

        <FormField label="Tone">
          <input
            className={inputClassName}
            onChange={(event) => onToneChange(event.target.value)}
            readOnly={isReadOnlyMode}
            value={tone}
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
              readOnly={isReadOnlyMode}
              value={promptingNotes}
            />
          </FormField>
        </div>
      </section>
    </div>
  );
}
