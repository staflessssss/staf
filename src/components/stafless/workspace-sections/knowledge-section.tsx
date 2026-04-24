import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  FormField,
  SurfaceCard,
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
  sectionCanvasClassName,
}: {
  blocks: KnowledgeDraft[];
  isReadOnlyMode: boolean;
  onAddBlock: () => void;
  onUpdateBlock: (index: number, patch: Partial<KnowledgeDraft>) => void;
  onMoveBlock: (index: number, direction: -1 | 1) => void;
  onRemoveBlock: (index: number) => void;
  sectionCanvasClassName: string;
}) {
  return (
    <SurfaceCard
      className="border-0 bg-transparent p-0 shadow-none"
      title="Knowledge"
      description="Store reusable knowledge as clear items: what this knowledge is, when the agent should use it, and the source content it can rely on."
      action={
        isReadOnlyMode ? null : (
          <button className={secondaryButtonClassName} onClick={onAddBlock} type="button">
            <Plus className="mr-2 size-4" />
            Add knowledge item
          </button>
        )
      }
    >
      <div className={sectionCanvasClassName}>
        {blocks.length === 0 ? (
          <EmptyState
            title="No knowledge items yet"
            description="Keep business facts separate from prompting and playbook. Each item should say what it contains, when the agent should reach for it, and the actual reference content."
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
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div
              key={block.uiId}
              className="rounded-[26px] bg-white/78 p-6 ring-1 ring-[#ece0d2]"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">Knowledge item {index + 1}</p>
                {!isReadOnlyMode ? (
                  <div className="flex gap-2">
                    <button
                      className={secondaryButtonClassName}
                      onClick={() => onMoveBlock(index, -1)}
                      type="button"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      className={secondaryButtonClassName}
                      onClick={() => onMoveBlock(index, 1)}
                      type="button"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
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
                  label="Knowledge name"
                  hint="Name the item the same way the operator thinks about it: pricing, service scope, FAQ, objection handling, and so on."
                >
                  <input
                    className={inputClassName}
                    onChange={(event) => onUpdateBlock(index, { name: event.target.value })}
                    readOnly={isReadOnlyMode}
                    value={block.name}
                  />
                </FormField>
                <FormField
                  label="When to use it"
                  hint="Describe the condition or situation when the agent should consult this knowledge item."
                >
                  <textarea
                    className={textareaClassName}
                    onChange={(event) =>
                      onUpdateBlock(index, { description: event.target.value })
                    }
                    readOnly={isReadOnlyMode}
                    value={block.description}
                  />
                </FormField>
                <FormField
                  label="Knowledge content"
                  hint="Put the actual facts, policy, wording, or reference material the agent can use once the condition is met."
                >
                  <textarea
                    className={textareaClassName}
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
      </div>
    </SurfaceCard>
  );
}
