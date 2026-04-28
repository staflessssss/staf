import {
  FormField,
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
  onToneChange,
  onPersonaChange,
  onPromptingInstructionChange,
  onPromptingNotesChange,
}: {
  isReadOnlyMode: boolean;
  tone: string;
  persona: string;
  promptingInstruction: string;
  promptingNotes: string;
  onToneChange: (value: string) => void;
  onPersonaChange: (value: string) => void;
  onPromptingInstructionChange: (value: string) => void;
  onPromptingNotesChange: (value: string) => void;
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
