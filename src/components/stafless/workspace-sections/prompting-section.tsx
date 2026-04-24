import {
  FormField,
  SurfaceCard,
  inputClassName,
  selectClassName,
  textareaClassName,
} from "@/components/stafless/foundation";

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
  sectionCanvasClassName,
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
  sectionCanvasClassName: string;
}) {
  return (
    <SurfaceCard
      className="rounded-[30px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] shadow-[0_16px_34px_rgba(31,23,40,0.05)]"
      title="Prompting"
      description="Persona, tone, and language now live in their own section instead of hiding inside a mixed basics step."
    >
      <div className={sectionCanvasClassName}>
        <FormField
          label="Instruction"
          hint="Explain who the agent is, how it should speak, and what matters most in the dialog."
        >
          <textarea
            className={textareaClassName}
            onChange={(event) => onPromptingInstructionChange(event.target.value)}
            placeholder="For example: You are the operator-facing AI assistant for this business. Reply briefly, clearly, and professionally. Identify the customer's need, keep the conversation moving, and never invent confirmed actions."
            value={promptingInstruction}
          />
        </FormField>
        <div className="mt-5 grid gap-4">
          <div className="rounded-[20px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Client identity visibility</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Let the model see the client identifier from the active channel when it helps personalize replies.
                </p>
              </div>
              <input
                checked={showContactIdentity}
                className="mt-1 h-5 w-5 rounded border-border"
                onChange={(event) => onShowContactIdentityChange(event.target.checked)}
                type="checkbox"
              />
            </div>
          </div>
          <div className="rounded-[20px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Messenger visibility</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Let the prompt mention which channel the conversation came from, so the agent can adapt phrasing to the surface.
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
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Tone">
            <select
              className={selectClassName}
              onChange={(event) => onToneChange(event.target.value)}
              value={tone}
            >
              <option value="friendly">Friendly</option>
              <option value="calm">Calm</option>
              <option value="premium">Premium</option>
              <option value="direct">Direct</option>
            </select>
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
        <div className="mt-5">
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
        </div>
        <div className="mt-5">
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
        <div className="mt-5 rounded-[20px] bg-white/70 p-5 ring-1 ring-[#eadccc]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8d7762]">
            Prompt identity layer
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Prompting defines who the agent is. Playbook defines how it moves the conversation. Messages defines how replies arrive in-channel.
          </p>
          <div className="mt-4 rounded-[16px] bg-[#fcfaf7] px-4 py-4 ring-1 ring-[#eee3d6]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d7762]">
              Preview effect
            </p>
            <p className="mt-2 text-sm leading-6 text-[#433a49]">
              This section now controls:
              {" "}
              instruction,
              {" "}
              persona,
              {" "}
              tone,
              {" "}
              preferred language,
              {" "}
              and whether runtime prompt context includes the client identity and current channel.
            </p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
