import { expect } from '@playwright/test';

// Local Supabase delivers auth emails to Mailpit instead of sending them.
const MAILPIT = 'http://127.0.0.1:54324';

type SearchResult = { messages: Array<{ ID: string }> };
type Message = { HTML: string; Text: string };

/** Waits for the newest email to `address` and returns the first auth link in it. */
export async function latestAuthLink(address: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = (await (
          await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)
        ).json()) as SearchResult;
        const id = search.messages[0]?.ID;
        if (!id) return undefined;
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as Message;
        const href = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(message.HTML)?.[1];
        link = href?.replace(/&amp;/g, '&');
        return link;
      },
      { message: `auth email for ${address}`, timeout: 15_000 },
    )
    .toBeTruthy();
  return link!;
}
