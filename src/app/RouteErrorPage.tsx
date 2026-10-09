import { MapPinOff } from 'lucide-react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { strings } from '@/strings/en';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={MapPinOff}
      title={strings.pages.notFound.title}
      body={strings.pages.notFound.body}
      action={
        <Link to="/" className="font-semibold text-accent-strong hover:underline">
          {strings.pages.notFound.home}
        </Link>
      }
    />
  );
}

/** Catches render errors and failed lazy imports (e.g. a stale chunk after a deploy). */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <NotFoundPage />
      </div>
    );
  }
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center">
        <ErrorState error={error} />
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {strings.common.retry}
        </Button>
      </div>
    </div>
  );
}
