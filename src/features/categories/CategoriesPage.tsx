import { ChevronLeft, Eye, EyeOff, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { cx } from '@/lib/cx';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useCategories, useSetCategoryHidden, type Category } from './api';
import { CategoryEditor } from './CategoryEditor';
import { CategoryIcon } from './CategoryIcon';
import { ENTRY_KINDS, type EntryKind } from '@/features/transactions/kinds';

const s = strings.categories;

/** Add, edit and hide categories. The reserved IOU categories are not listed. */
export function CategoriesPage() {
  const categories = useCategories();
  const setHidden = useSetCategoryHidden();
  const online = useOnlineStatus();
  const [editor, setEditor] = useState<{ open: boolean; category?: Category | undefined; key: number }>({
    open: false,
    key: 0,
  });

  const open = (category?: Category) => setEditor((e) => ({ open: true, category, key: e.key + 1 }));
  const close = () => setEditor((e) => ({ ...e, open: false }));

  function section(kind: EntryKind) {
    const list = (categories.data ?? []).filter((c) => c.kind === kind && !c.is_system);
    return (
      <Card key={kind} className="p-2">
        <h2 className="px-3 pt-3 pb-1 text-lg font-bold">{s.sections[kind]}</h2>
        <ul>
          {list.map((category) => (
            <li key={category.id} className="flex items-center gap-2 rounded-control px-2 py-1.5">
              <CategoryIcon icon={category.icon} tone={kind} className={cx(category.is_hidden && 'opacity-50')} />
              <span className={cx('min-w-0 flex-1 truncate font-medium', category.is_hidden && 'text-fg-muted')}>
                {category.name}
                {category.is_hidden ? (
                  <span className="ml-2 rounded-full bg-hover px-2 py-0.5 text-xs font-semibold text-fg-muted">{s.hidden}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => open(category)}
                aria-label={s.editLabel(category.name)}
                className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
              >
                <Pencil aria-hidden="true" className="size-4.5" />
              </button>
              <button
                type="button"
                disabled={!online}
                onClick={() => setHidden.mutate({ id: category.id, hidden: !category.is_hidden })}
                aria-label={category.is_hidden ? s.showLabel(category.name) : s.hideLabel(category.name)}
                aria-pressed={category.is_hidden}
                className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
              >
                {category.is_hidden ? <Eye aria-hidden="true" className="size-4.5" /> : <EyeOff aria-hidden="true" className="size-4.5" />}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <>
      <Link
        to="/settings"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-control px-2 text-sm font-semibold text-fg-muted hover:text-fg"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {strings.pages.settings.title}
      </Link>
      <PageHeader
        title={strings.pages.categories.title}
        actions={
          <Button onClick={() => open()} disabled={!online} icon={<Plus aria-hidden="true" className="size-4" />}>
            {s.add}
          </Button>
        }
      />
      <p className="mt-1 text-sm text-fg-muted">{s.hiddenHint}</p>

      <div className="mt-4 grid gap-4 wide:grid-cols-2 wide:items-start">
        {categories.isPending ? (
          <Skeleton className="h-80" />
        ) : (categories.isError && categories.data === undefined) ? (
          <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
        ) : (
          ENTRY_KINDS.map(section)
        )}
      </div>

      <ResponsiveDialog
        open={editor.open}
        onOpenChange={(next) => (next ? undefined : close())}
        title={editor.category ? s.editor.editTitle : s.editor.addTitle}
        description={s.editor.description}
      >
        <CategoryEditor key={editor.key} category={editor.category} onDone={close} />
      </ResponsiveDialog>
    </>
  );
}
