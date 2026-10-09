import { useId } from 'react';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import { categoryLabel, type Category } from './api';
import { CategoryGlyph } from './CategoryIcon';

type CategoryPickerProps = {
  categories: readonly Category[];
  value: string;
  onChange: (id: string) => void;
  error?: string | undefined;
};

/** Category chips: native radios underneath, so arrow keys and screen readers work as expected. */
export function CategoryPicker({ categories, value, onChange, error }: CategoryPickerProps) {
  const name = useId();
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm font-medium">{strings.form.category}</legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          return (
            <label
              key={category.id}
              className={cx(
                'relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-control pr-3.5 pl-2.5 text-sm font-medium',
                'hover:bg-hover has-checked:bg-accent-strong has-checked:text-on-accent',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-strong',
              )}
            >
              <input
                type="radio"
                name={name}
                value={category.id}
                checked={category.id === value}
                onChange={() => onChange(category.id)}
                className="sr-only"
              />
              <CategoryGlyph icon={category.icon} className="size-4.5" />
              {categoryLabel(category)}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-sm font-medium text-expense-strong">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
