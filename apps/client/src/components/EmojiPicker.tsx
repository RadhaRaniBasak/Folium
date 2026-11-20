import { EmojiPicker as Picker, type EmojiDataResolver } from 'frimousse';
import { loadFrimousseData } from '@blocknote/core/emoji-data';
import { ArrowShuffle } from '../lib/icons';
import { cn, pick, RANDOM_ICONS } from '../lib/utils';

// Emoji data ships with BlockNote, so the picker works offline (no CDN fetch).
const resolveEmojiData: EmojiDataResolver = (locale) =>
  loadFrimousseData(locale) as ReturnType<EmojiDataResolver>;

export function EmojiPicker({
  onPick,
  onRemove,
}: {
  onPick: (emoji: string) => void;
  onRemove?: () => void;
}) {
  return (
    <Picker.Root
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      resolveEmojiData={resolveEmojiData}
      columns={9}
      className="isolate flex h-[340px] w-[328px] flex-col"
    >
      <div className="flex items-center gap-1 p-1">
        <Picker.Search
          autoFocus
          placeholder="Filter…"
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-strong outline-none placeholder:text-faint focus:border-accent/60"
        />
        <button
          type="button"
          title="Random"
          onClick={() => onPick(pick(RANDOM_ICONS))}
          className="hover-fill grid size-8 place-items-center rounded-lg text-muted"
        >
          <ArrowShuffle size={14} />
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="hover-fill h-8 rounded-lg px-2 text-[12.5px] font-medium text-muted hover:text-strong"
          >
            Remove
          </button>
        )}
      </div>
      <Picker.Viewport className="relative flex-1 outline-none">
        <Picker.Loading className="absolute inset-0 grid place-items-center text-[12.5px] text-faint">
          Loading…
        </Picker.Loading>
        <Picker.Empty className="absolute inset-0 grid place-items-center text-[12.5px] text-faint">
          No emoji found
        </Picker.Empty>
        <Picker.List
          className="select-none pb-1"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className="bg-raised px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint"
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1 px-1" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                className={cn(
                  'grid size-[34px] place-items-center rounded-lg text-[20px]',
                  emoji.isActive && 'bg-hover',
                )}
                {...props}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </Picker.Viewport>
    </Picker.Root>
  );
}
