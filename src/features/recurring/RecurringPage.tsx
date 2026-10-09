import { ChevronLeft, Pause, Pencil, Play, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { categoryLabel, useCategories, useCategoryMap } from '@/features/categories/api';
import { useMoney } from '@/features/money/useMoney';
import { formatDate } from '@/domain/dates';
import { formatSignedMoney } from '@/domain/money';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useDeleteRecurringRule, useRecurringRules, useSetRecurringRuleActive, type RecurringRule } from './api';
import { RecurringRuleForm } from './RecurringRuleForm';
import { AMOUNT_TEXT } from '@/features/transactions/kinds';

const s = strings.recurring;

/** Settings > Recurring transactions: edit, pause / resume, or stop each rule. */
export function RecurringPage() {
  const rules = useRecurringRules();
  const categories = useCategories();
  const categoryMap = useCategoryMap();
  const money = useMoney();
  const online = useOnlineStatus();
  const toast = useToast();
  const setActive = useSetRecurringRuleActive();
  const remove = useDeleteRecurringRule();
  const [editing, setEditing] = useState<{ rule: RecurringRule; key: number } | null>(null);
  const [deleting, setDeleting] = useState<RecurringRule | null>(null);

  const nameOf = (rule: RecurringRule) => {
    const category = categoryMap.get(rule.category_id);
    return rule.payee ?? (category ? categoryLabel(category) : '');
  };

  let body;
  if (rules.isError && rules.data === undefined) {
    body = <ErrorState error={rules.error} onRetry={() => void rules.refetch()} />;
  } else if (rules.isPending || !money) {
    body = <Skeleton className="m-3 h-40" />;
  } else if (rules.data.length === 0) {
    body = <EmptyState icon={Repeat} title={s.emptyTitle} body={s.emptyBody} />;
  } else {
    body = (
      <ul>
        {rules.data.map((rule) => {
          const category = categoryMap.get(rule.category_id);
          const name = nameOf(rule);
          return (
            <li key={rule.id} className="flex items-center gap-3 rounded-control px-3 py-3" data-testid="recurring-rule">
              <CategoryIcon icon={category?.icon ?? 'tag'} tone={rule.type} className={cx(!rule.is_active && 'opacity-50')} />
              <span className="min-w-0 flex-1">
                <span className={cx('block truncate font-semibold', !rule.is_active && 'text-fg-muted')}>{name}</span>
                <span className="block truncate text-sm text-fg-muted">
                  {s.every[rule.frequency]} · {rule.is_active ? s.next(formatDate(rule.next_due_date)) : s.paused}
                </span>
              </span>
              <span className={cx('shrink-0 font-bold tabular', AMOUNT_TEXT[rule.type])}>
                {formatSignedMoney(rule.type, rule.amount_minor, rule.currency, money.exponentOf(rule.currency))}
              </span>
              <span className="flex shrink-0">
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setEditing({ rule, key: Date.now() })}
                  aria-label={s.editLabel(name)}
                  className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={!online}
                  onClick={() =>
                    setActive.mutate(
                      { id: rule.id, active: !rule.is_active },
                      {
                        onSuccess: () => toast({ message: rule.is_active ? s.pausedToast : s.resumedToast }),
                        onError: (error) => toast({ message: errorMessage(error) }),
                      },
                    )
                  }
                  aria-label={rule.is_active ? s.pauseLabel(name) : s.resumeLabel(name)}
                  className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                >
                  {rule.is_active ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
                </button>
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setDeleting(rule)}
                  aria-label={s.deleteLabel(name)}
                  className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-hover hover:text-expense-strong disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
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
      <PageHeader title={s.title} />
      <p className="mt-1 mb-4 text-sm text-fg-muted">{s.hint}</p>
      <Card className="p-2">{body}</Card>

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(next) => (next ? undefined : setEditing(null))}
        title={s.form.title}
        description={s.form.description}
      >
        {editing && money && categories.data ? (
          <RecurringRuleForm
            key={editing.key}
            rule={editing.rule}
            money={money}
            categories={categories.data}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </ResponsiveDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => (next ? undefined : setDeleting(null))}
        title={s.confirmDelete.title}
        body={s.confirmDelete.body}
        confirmLabel={s.confirmDelete.confirm}
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast({ message: s.deleted });
              setDeleting(null);
            },
            onError: (error) => toast({ message: errorMessage(error) }),
          });
        }}
      />
    </>
  );
}
