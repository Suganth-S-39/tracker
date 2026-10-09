import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { useOnlineStatus } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { strings } from '@/strings/en';

const s = strings.settings.deleteAccount;

/**
 * Deletes the account and everything in it (spec section 10) through the delete-account Edge
 * Function, then signs out and returns to sign-in. Typing a word guards against slips.
 */
export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const inputId = useId();
  const confirmed = typed.trim() === s.confirmWord;

  async function deleteAccount() {
    setPending(true);
    setFailed(false);
    // functions-js types `error` as any, so it is only checked, never destructured.
    const result = await supabase.functions.invoke<{ deleted: boolean }>('delete-account', { method: 'POST' });
    if (result.error || !result.data?.deleted) {
      setPending(false);
      setFailed(true);
      return;
    }
    // The account no longer exists on the server; forget the local session, then load the sign-in
    // page fresh. (A client-side navigate would race the auth guard's own redirect, and a full
    // load also drops every bit of in-memory state.)
    await supabase.auth.signOut({ scope: 'local' });
    queryClient.clear();
    window.location.replace('/sign-in?deleted=1');
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('');
        onOpenChange(next);
      }}
      title={s.dialogTitle}
      description={s.dialogBody}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {s.confirmLabel(s.confirmWord)}
          </label>
          <input
            id={inputId}
            data-autofocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="block h-12 w-full rounded-control border border-control-border bg-surface px-3.5 text-base font-semibold tracking-wide"
          />
        </div>
        {failed ? <Alert tone="error">{s.failed}</Alert> : null}
        {online ? null : <Alert tone="error">{strings.offline.cantSave}</Alert>}
        <div className="flex flex-col-reverse gap-2 wide:flex-row wide:justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {strings.common.cancel}
          </Button>
          <Button variant="danger" disabled={!confirmed || !online} loading={pending} onClick={() => void deleteAccount()}>
            {s.confirm}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
