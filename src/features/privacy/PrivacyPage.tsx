import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { BrandMark } from '@/components/layout/BrandMark';
import { Card } from '@/components/ui/Card';
import { usePageTitle } from '@/lib/usePageTitle';
import { strings } from '@/strings/en';

/**
 * Back, for the installed app (which has no browser back button). Opened from inside the app, it
 * returns to where the person was; opened directly, it goes to the start screen (Home, or Sign in
 * when signed out).
 */
function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => void (location.key === 'default' ? navigate('/') : navigate(-1));
  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-2 inline-flex h-10 items-center gap-1 rounded-control px-2 text-sm font-semibold text-fg-muted hover:text-fg"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {strings.common.back}
    </button>
  );
}

/** Public, plain-language privacy policy (spec section 10). */
export function PrivacyPage() {
  usePageTitle(strings.pages.privacy.title);
  const p = strings.privacy;
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-page pb-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <BackButton />
        <BrandMark />
      </div>
      <main>
        <Card className="p-6 wide:p-10">
          <h1 className="text-[2rem] leading-tight font-bold">{strings.pages.privacy.title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{p.updated}</p>
          <p className="mt-5 text-lg">{p.intro}</p>
          {p.sections.map((section) => (
            <section key={section.title} className="mt-7">
              <h2 className="text-xl font-bold">{section.title}</h2>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </Card>
      </main>
    </div>
  );
}
