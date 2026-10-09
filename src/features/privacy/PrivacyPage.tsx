import { Link } from 'react-router';
import { BrandMark } from '@/components/layout/BrandMark';
import { Card } from '@/components/ui/Card';
import { usePageTitle } from '@/lib/usePageTitle';
import { strings } from '@/strings/en';

/** Public, plain-language privacy policy (spec section 10). */
export function PrivacyPage() {
  usePageTitle(strings.pages.privacy.title);
  const p = strings.privacy;
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10 pt-safe">
      <Link to="/" className="mb-8 self-start">
        <BrandMark />
      </Link>
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
