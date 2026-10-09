import { ArrowDownUp } from 'lucide-react';
import { strings } from '@/strings/en';

/** Placeholder logo and name (open item 9). */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5 text-lg font-bold">
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-hero text-on-hero">
        <ArrowDownUp className="size-5" strokeWidth={2.5} />
      </span>
      {strings.app.name}
    </span>
  );
}
