import { TextField } from '@/components/ui/Field';
import { formatDate } from '@/domain/dates';
import { strings } from '@/strings/en';
import type { ConversionState } from './useConversion';

const s = strings.form.conversion;

type ConversionPanelProps = {
  state: ConversionState;
  showErrors: boolean;
  /** Called whenever the user edits the rate or converted amount. */
  onEdit?: () => void;
};

/**
 * Shows the converted amount and the rate used; the user can edit either and the other one
 * recalculates (spec section 8). Renders nothing when no conversion is needed.
 */
export function ConversionPanel({ state, showErrors, onEdit }: ConversionPanelProps) {
  const { conversion, latest, currency, target } = state;
  if (state.sameCurrency) return null;

  const status =
    latest.isPending && conversion.source === 'none'
      ? s.loading
      : conversion.source === 'latest' && latest.data && !state.usingStoredRate
        ? s.latest(formatDate(latest.data.date))
        : conversion.source === 'none'
          ? s.noRate
          : s.edited;

  return (
    <div className="rounded-control bg-control p-4">
      <p className="text-sm font-semibold">{s.heading(target)}</p>
      <p className="mt-0.5 text-sm text-fg-muted" aria-live="polite">
        {status}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <TextField
          label={s.rate(currency, target)}
          inputMode="decimal"
          autoComplete="off"
          value={conversion.rateField}
          error={showErrors && conversion.invalid === 'rate' ? strings.form.errors.rate : undefined}
          onChange={(e) => {
            onEdit?.();
            state.setRateText(e.target.value);
          }}
        />
        <TextField
          label={s.converted(target)}
          inputMode="decimal"
          autoComplete="off"
          value={conversion.convertedField}
          error={showErrors && conversion.invalid === 'converted' ? strings.form.errors.converted : undefined}
          onChange={(e) => {
            onEdit?.();
            state.setConvertedText(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
