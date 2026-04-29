import { ArrowDown, ArrowUp, BookOpen, Plus, Trash2, X } from "lucide-react";

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
  onCloseEditor,
  onOpenBlock,
  onUpdateBlock,
  onMoveBlock,
  onRemoveBlock,
  selectedBlockIndex,
}: {
  blocks: KnowledgeDraft[];
  isReadOnlyMode: boolean;
  onAddBlock: () => void;
  onCloseEditor: () => void;
  onOpenBlock: (index: number) => void;
  onUpdateBlock: (index: number, patch: Partial<KnowledgeDraft>) => void;
  onMoveBlock: (index: number, direction: -1 | 1) => void;
  onRemoveBlock: (index: number) => void;
  selectedBlockIndex: number | null;
}) {
  const selectedBlock =
    selectedBlockIndex === null ? null : blocks[selectedBlockIndex] ?? null;
  const dialogTitleId =
    selectedBlockIndex === null ? undefined : `knowledge-editor-title-${selectedBlockIndex}`;

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
            <article
              key={block.uiId}
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onOpenBlock(index)}
                  type="button"
                >
                  <span className="block truncate text-base font-semibold text-[#111827]">
                    {block.name.trim() || `Untitled knowledge ${index + 1}`}
                  </span>
                  <span className="mt-1 block text-sm text-[#667085]">
                    {block.description.trim() || "No usage condition yet."}
                  </span>
                  <span
                    className={
                      block.name.trim() && block.description.trim() && block.knowledgeContent.trim()
                        ? "mt-3 inline-flex rounded-full bg-[#ecfdf3] px-2.5 py-1 text-xs font-semibold text-[#067647]"
                        : "mt-3 inline-flex rounded-full bg-[#fff4ed] px-2.5 py-1 text-xs font-semibold text-[#b54708]"
                    }
                  >
                    {block.name.trim() && block.description.trim() && block.knowledgeContent.trim()
                      ? "Ready"
                      : "Incomplete"}
                  </span>
                  {block.knowledgeContent.trim() ? (
                    <span className="mt-3 block max-h-[44px] overflow-hidden text-sm leading-5 text-[#667085]">
                      {block.knowledgeContent}
                    </span>
                  ) : null}
                </button>
                {!isReadOnlyMode ? (
                  <div className="flex shrink-0 gap-2">
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
            </article>
          ))}
        </div>
      </section>

      {selectedBlock && selectedBlockIndex !== null ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#101828]/20 backdrop-blur-[1px]">
          <button
            aria-label="Close knowledge editor"
            className="hidden flex-1 cursor-default bg-transparent lg:block"
            onClick={onCloseEditor}
            type="button"
          />
          <aside
            aria-labelledby={dialogTitleId}
            aria-modal="true"
            className="flex h-full w-full max-w-[560px] flex-col border-l border-[#dbe3ef] bg-white shadow-[0_24px_70px_rgba(16,24,40,0.18)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e8edf5] px-6 py-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
                  Knowledge item
                </p>
                <h2
                  className="mt-2 truncate text-lg font-semibold text-[#101828]"
                  id={dialogTitleId}
                >
                  {selectedBlock.name.trim() || `Untitled knowledge ${selectedBlockIndex + 1}`}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Edit the facts this agent can use in customer conversations.
                </p>
              </div>
              <button
                aria-label="Close knowledge editor"
                className={secondaryButtonClassName}
                onClick={onCloseEditor}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <FormField
                label="Name"
                hint="For example: pricing, services, FAQ, refund policy."
              >
                <input
                  className={inputClassName}
                  maxLength={120}
                  onChange={(event) =>
                    onUpdateBlock(selectedBlockIndex, { name: event.target.value })
                  }
                  readOnly={isReadOnlyMode}
                  value={selectedBlock.name}
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
                    onUpdateBlock(selectedBlockIndex, { description: event.target.value })
                  }
                  readOnly={isReadOnlyMode}
                  value={selectedBlock.description}
                />
              </FormField>
              <FormField
                label="Facts"
                hint="Write the exact information the agent can use in replies."
              >
                <textarea
                  className={`${textareaClassName} min-h-[260px]`}
                  maxLength={10_000}
                  onChange={(event) =>
                    onUpdateBlock(selectedBlockIndex, { knowledgeContent: event.target.value })
                  }
                  readOnly={isReadOnlyMode}
                  value={selectedBlock.knowledgeContent}
                />
              </FormField>
            </div>

            <div className="flex justify-end border-t border-[#e8edf5] px-6 py-4">
              <button className={secondaryButtonClassName} onClick={onCloseEditor} type="button">
                Done
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
