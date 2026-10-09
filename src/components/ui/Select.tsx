import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '@/lib/cx';
import { edgeIndex, findTypeahead, moveIndex } from './selectNavigation';

/** `triggerLabel`: a shorter text for the closed control (e.g. "USD" for "USD · US dollar"). */
export type SelectOption = { value: string; label: string; triggerLabel?: string; disabled?: boolean };
export type SelectGroup = { label: string; options: readonly SelectOption[] };
export type SelectItems = readonly (SelectOption | SelectGroup)[];

const isGroup = (item: SelectOption | SelectGroup): item is SelectGroup => 'options' in item;

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  items: SelectItems;
  /** The closed control's look (a form field, a filter chip...). The open list is the same everywhere. */
  triggerClassName: string;
  /** Accessible name: the id of a visible label, or a text label. */
  labelledBy?: string | undefined;
  label?: string | undefined;
  describedBy?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
  /** Shown when no option has the current value. */
  placeholder?: string | undefined;
  id?: string | undefined;
};

const VIEWPORT_MARGIN = 8;
const GAP = 6;
const MAX_LIST_HEIGHT = 360;
const TYPEAHEAD_RESET_MS = 600;

/**
 * A select in the app's own style (the native one opens the operating system's list).
 *
 * Follows the WAI-ARIA "select-only combobox" pattern: focus stays on the combobox, the active
 * option is announced through aria-activedescendant. Keyboard: arrows, Home/End, Page Up/Down,
 * Enter/Space to choose, Escape to close, typing to jump; Tab chooses the active option and moves
 * on. The list opens in the browser's top layer (popover API), so nothing can clip or cover it,
 * and flips above the control when there's more room there. Options are only rendered while open.
 */
export function Select({
  value,
  onChange,
  items,
  triggerClassName,
  labelledBy,
  label,
  describedBy,
  invalid = false,
  disabled = false,
  placeholder,
  id: idProp,
}: SelectProps) {
  const generated = useId();
  const id = idProp ?? `select${generated}`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const flat = items.flatMap((item) => (isGroup(item) ? item.options : [item]));
  const labels = flat.map((o) => o.label);
  const disabledFlags = flat.map((o) => Boolean(o.disabled));
  const flatIndex = new Map(flat.map((o, i) => [o.value, i]));
  const selectedIndex = flatIndex.get(value) ?? -1;
  const selected = flat[selectedIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', timer: 0 });

  function openList(start: number = selectedIndex >= 0 ? selectedIndex : edgeIndex('first', disabledFlags)) {
    if (disabled) return;
    setActive(start);
    setOpen(true);
  }
  function close() {
    setOpen(false);
  }
  function choose(index: number) {
    const option = flat[index];
    if (option && !option.disabled && option.value !== value) onChange(option.value);
    close();
  }
  function typeTo(char: string) {
    const t = typeahead.current;
    window.clearTimeout(t.timer);
    t.text += char;
    t.timer = window.setTimeout(() => (t.text = ''), TYPEAHEAD_RESET_MS);
    const match = findTypeahead(labels, disabledFlags, t.text, open ? active : selectedIndex);
    if (match === -1) return;
    if (open) setActive(match);
    else openList(match);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const { key } = event;
    const printable = key.length === 1 && key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        openList();
      } else if (key === 'Home' || key === 'End') {
        event.preventDefault();
        openList(edgeIndex(key === 'Home' ? 'first' : 'last', disabledFlags));
      } else if (printable) {
        typeTo(key);
      }
      return;
    }
    switch (key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'PageDown':
      case 'PageUp': {
        event.preventDefault();
        const delta = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : key === 'PageDown' ? 10 : -10;
        setActive((current) => moveIndex(current, delta, disabledFlags));
        break;
      }
      case 'Home':
      case 'End':
        event.preventDefault();
        setActive(edgeIndex(key === 'Home' ? 'first' : 'last', disabledFlags));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(active);
        break;
      case 'Escape':
        // A dialog around this select ignores this Escape (see ResponsiveDialog).
        event.preventDefault();
        close();
        break;
      case 'Tab':
        choose(active);
        break;
      default:
        if (printable) typeTo(key);
    }
  }

  // Show the list in the top layer and place it next to the control.
  useLayoutEffect(() => {
    const list = listRef.current;
    const trigger = triggerRef.current;
    if (!open || !list || !trigger) return;
    if (!list.matches(':popover-open')) list.showPopover();
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = document.documentElement.clientWidth;
    list.style.minWidth = `${rect.width}px`;
    list.style.maxWidth = `${viewportWidth - VIEWPORT_MARGIN * 2}px`;
    const below = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const above = rect.top - GAP - VIEWPORT_MARGIN;
    const natural = list.scrollHeight;
    const placeBelow = natural <= below || below >= above;
    const height = Math.min(natural, MAX_LIST_HEIGHT, Math.max(placeBelow ? below : above, 120));
    list.style.maxHeight = `${height}px`;
    list.style.top = `${placeBelow ? rect.bottom + GAP : rect.top - GAP - height}px`;
    list.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(rect.left, viewportWidth - VIEWPORT_MARGIN - list.offsetWidth))}px`;
    list.style.transformOrigin = placeBelow ? 'top' : 'bottom';
  }, [open]);

  // Keep the active option in view: centered when the list opens, then just enough while moving.
  // Scrolls only the list (scrollIntoView could also scroll a dialog or the page around it).
  const centeredOnOpen = useRef(false);
  useEffect(() => {
    const list = listRef.current;
    const option = active >= 0 ? document.getElementById(`${id}-option-${active}`) : null;
    if (!open) {
      centeredOnOpen.current = false;
      return;
    }
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (!centeredOnOpen.current) {
      centeredOnOpen.current = true;
      list.scrollTop = top - (list.clientHeight - option.offsetHeight) / 2;
    } else if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [open, active, id]);

  // Close on a press outside, when scrolling moves the control (the list would drift off it), or
  // on resize. Scroll events arrive a frame late, and focusing the control can nudge its scroll
  // container, so a scroll only closes the list if the control really moved.
  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    const anchor = triggerRef.current?.getBoundingClientRect();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !listRef.current?.contains(target)) dismiss();
    };
    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      const now = triggerRef.current?.getBoundingClientRect();
      if (!anchor || !now || Math.abs(now.top - anchor.top) > 1 || Math.abs(now.left - anchor.left) > 1) dismiss();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  const renderOption = (option: SelectOption) => {
    const i = flatIndex.get(option.value) ?? -1;
    const isSelected = option.value === value;
    return (
      <div
        key={option.value}
        id={optionId(i)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled || undefined}
        onPointerMove={() => !option.disabled && setActive(i)}
        onClick={() => !option.disabled && choose(i)}
        className={cx(
          'flex min-h-10 items-center gap-2 rounded-xl px-2.5 py-2 text-[0.9375rem] leading-snug',
          option.disabled ? 'cursor-default text-fg-muted' : 'cursor-pointer',
          i === active && !option.disabled && 'bg-hover',
          isSelected && 'font-semibold',
        )}
      >
        <Check aria-hidden="true" className={cx('size-4 shrink-0 text-accent-strong', !isSelected && 'invisible')} strokeWidth={2.75} />
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
      </div>
    );
  };

  return (
    <>
      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        onBlur={close}
        className={cx('flex cursor-pointer items-center justify-between gap-1.5 select-none', disabled && 'pointer-events-none opacity-60', triggerClassName)}
      >
        <span className={cx('min-w-0 truncate', !selected && 'text-fg-muted')}>{selected?.triggerLabel ?? selected?.label ?? placeholder ?? ''}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-70" strokeWidth={2.25} />
      </div>
      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          popover="manual"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : label}
          // Keep focus on the combobox when an option is pressed.
          onMouseDown={(event) => event.preventDefault()}
          className="glass-strong inset-auto m-0 animate-pop-in overflow-y-auto overscroll-contain rounded-2xl p-1.5 text-fg"
        >
          {items.map((item, groupIndex) =>
            isGroup(item) ? (
              <div key={`group-${item.label}`} role="group" aria-labelledby={`${id}-group-${groupIndex}`}>
                <div id={`${id}-group-${groupIndex}`} className="px-2.5 pt-2.5 pb-1 text-xs font-semibold tracking-wide text-fg-muted">
                  {item.label}
                </div>
                {item.options.map(renderOption)}
              </div>
            ) : (
              renderOption(item)
            ),
          )}
        </div>
      ) : null}
    </>
  );
}
