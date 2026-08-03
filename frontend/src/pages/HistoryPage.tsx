import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessionHistory } from '../api/rooms';
import { getApiErrorMessage } from '../lib/api-error';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/LoadingSkeleton';
import { sendFriendRequest } from '../api/social';
import { useToastStore } from '../store/toast-store';

export function HistoryPage() {
  const queryClient = useQueryClient();
  const toast = useToastStore((state) => state.add);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['session-history', page],
    queryFn: () => getSessionHistory(page),
    placeholderData: (previous) => previous,
  });
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.limit ?? 10)));
  const addFriend = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: async () => {
      toast('success', 'Friend request sent.');
      await queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error) => toast('error', getApiErrorMessage(error, 'Could not send that friend request.')),
  });

  return (
    <main className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Your progress</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div><h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Session history</h1><p className="mt-3 text-sm text-slate-500">Every completed conversation, saved in one place.</p></div>
          {query.data && <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{query.data.total} sessions</span>}
        </div>

        {query.isLoading && <div className="mt-8 space-y-3" aria-label="Loading session history">{[1, 2, 3].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex gap-4"><Skeleton className="h-11 w-11 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/5" /></div></div><Skeleton className="mt-5 h-10 w-full" /></div>)}</div>}
        {query.isError && <div role="alert" className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{getApiErrorMessage(query.error, 'Could not load your history.')}</div>}
        {query.data?.items.length === 0 && (
          <div className="mt-8"><EmptyState icon="💬" mood="encouraging" title="Let’s do your first session" detail="Complete both rounds in a room and your conversation will appear here." /></div>
        )}
        {query.data && query.data.items.length > 0 && (
          <div className={`mt-8 space-y-3 transition ${query.isFetching ? 'opacity-60' : ''}`}>
            {query.data.items.map((session, index) => (
              <article key={session.roomId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="flex gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 font-display text-sm font-extrabold text-brand-700">#{(page - 1) * 10 + index + 1}</span>
                    <div>
                      <time className="text-sm font-bold text-ink" dateTime={session.date}>{formatDate(session.date)}</time>
                      <p className="mt-1 text-xs font-medium text-slate-400">{formatDuration(session.durationSec)} speaking session</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">{session.partners.map((partner) => <div key={partner.id} className="flex items-center gap-1 rounded-full bg-slate-100 p-1 pl-3"><span className="text-xs font-semibold text-slate-600">{partner.displayName} · @{partner.handle}</span><button type="button" disabled={addFriend.isPending} onClick={() => addFriend.mutate(partner.id)} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-sm">Add friend</button></div>)}</div>
                </div>
                <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  {session.topics.map((topic, topicIndex) => <p key={topic} className="text-sm leading-5 text-slate-600"><span className="mr-2 font-bold text-brand-700">R{topicIndex + 1}</span>{topic}</p>)}
                </div>
              </article>
            ))}
          </div>
        )}

        {query.data && query.data.total > query.data.limit && (
          <div className="mt-7 flex items-center justify-center gap-3">
            <button className="secondary-button !py-2" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span className="text-sm font-semibold text-slate-500">Page {page} of {totalPages}</span>
            <button className="secondary-button !py-2" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </div>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
