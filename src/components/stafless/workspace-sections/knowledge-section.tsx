import { ArrowDown, ArrowUp, BookOpen, Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  FormField,
  inputClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "@/components/stafless/foundation";

type KnowledgeDraft = {
  uiId: string;
  name: string;
  description: string;
  knowledgeContent: string;
};

export function KnowledgeSection({
  blocks,
  isReadOnlyMode,
  onAddBlock,
  onUpdateBlock,
  onMoveBlock,
  onRemoveBlock,
}: {
  blocks: KnowledgeDraft[];
  isReadOnlyMode: boolean;
  onAddBlock: () => void;
  onUpdateBlock: (index: number, patch: Partial<KnowledgeDraft>) => void;
  onMoveBlock: (index: number, direction: -1 | 1) => void;
  onRemoveBlock: (index: number) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[920px] space-y-6">
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#e8edf5] pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#101828]">
                Knowledge
              </h1>
              <BookOpen className="size-4 text-[#98a2b3]" />
            </div>
            <p className="mt-2 max-w-[620px] text-sm leading-6 text-[#667085]">
              Add the business facts the agent can rely on in conversation.
            </p>
          </div>
          {isReadOnlyMode ? null : (
            <button className={secondaryButtonClassName} onClick={onAddBlock} type="button">
              <Plus className="mr-2 size-4" />
              Add item
            </button>
          )}
        </div>

        <div className="space-y-4">
          {blocks.length === 0 ? (
            <EmptyState
              title="No knowledge yet"
              description="Add services, prices, policies, FAQs, or other facts the agent should use when answering customers."
              action={
                isReadOnlyMode ? undefined : (
                  <button className={secondaryButtonClassName} onClick={onAddBlock} type="button">
                    <Plus className="mr-2 size-4" />
                    Add first item
                  </button>
                )
              }
            />
          ) : null}

          {blocks.map((block, index) => (
            <div
              key={block.uiId}
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[#111827]">
                    {block.name.trim() || `Untitled knowledge ${index + 1}`}
                  </p>
                  <p className="mt-1 text-sm text-[#667085]">
                    {block.name.trim() && block.description.trim() && block.knowledgeContent.trim()
                      ? "Ready"
                      : "Incomplete"}
                  </p>
                </div>
                {!isReadOnlyMode ? (
                  <div className="flex gap-2">
                    <button
                      aria-label={`Move ${block.name.trim() || `knowledge item ${index + 1}`} up`}
                      className={secondaryButtonClassName}
                      disabled={index === 0}
                      onClick={() => onMoveBlock(index, -1)}
                      type="button"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      aria-label={`Move ${block.name.trim() || `knowledge item ${index + 1}`} down`}
                      className={secondaryButtonClassName}
                      disabled={index === blocks.length - 1}
                      onClick={() => onMoveBlock(index, 1)}
                      type="button"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      aria-label={`Delete ${block.name.trim() || `knowledge item ${index + 1}`}`}
                      className={secondaryButtonClassName}
                      onClick={() => onRemoveBlock(index)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-4">
                <FormField
                  label="Name"
                  hint="For example: pricing, services, FAQ, refund policy."
                >
                  <input
                    className={inputClassName}
                    maxLength={120}
                    onChange={(event) => onUpdateBlock(index, { name: event.target.value })}
                    readOnly={isReadOnlyMode}
                    value={block.name}
                  />
                </FormField>
                <FormField
                  label="Use when"
                  hint="Describe when the agent should use this item."
                >
                  <textarea
                    className={textareaClassName}
                    maxLength={500}
                    onChange={(event) =>
                      onUpdateBlock(index, { description: event.target.value })
                    }
                    readOnly={isReadOnlyMode}
                    value={block.description}
                  />
                </FormField>
                <FormField
                  label="Facts"
                  hint="Write the exact information the agent can use in replies."
                >
                  <textarea
                    className={textareaClassName}
                    maxLength={10_000}
                    onChange={(event) =>
                      onUpdateBlock(index, { knowledgeContent: event.target.value })
                    }
                    readOnly={isReadOnlyMode}
                    value={block.knowledgeContent}
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
