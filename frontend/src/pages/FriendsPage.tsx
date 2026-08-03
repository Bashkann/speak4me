import { useDeferredValue, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptFriendRequest,
  blockUser,
  declineFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  type PublicProfile,
  type UserSearchResult,
} from '../api/social';
import { EmptyState } from '../components/EmptyState';
import { PanelSkeleton } from '../components/LoadingSkeleton';
import { getApiErrorMessage } from '../lib/api-error';
import { useToastStore } from '../store/toast-store';

export function FriendsPage() {
  const queryClient = useQueryClient();
  const toast = useToastStore((state) => state.add);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const friends = useQuery({ queryKey: ['friends'], queryFn: getFriends });
  const requests = useQuery({ queryKey: ['friend-requests'], queryFn: getFriendRequests });
  const discovery = useQuery({
    queryKey: ['user-search', deferredSearch],
    queryFn: () => searchUsers(deferredSearch),
    enabled: deferredSearch.length >= 2,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['friends'] }),
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['user-search'] }),
    ]);
  };

  const action = useMutation({
    mutationFn: async (input: { type: 'request' | 'accept' | 'decline' | 'remove' | 'block'; id: string; name: string }) => {
      if (input.type === 'request') await sendFriendRequest(input.id);
      if (input.type === 'accept') await acceptFriendRequest(input.id);
      if (input.type === 'decline') await declineFriendRequest(input.id);
      if (input.type === 'remove') await removeFriend(input.id);
      if (input.type === 'block') await blockUser(input.id);
      return input;
    },
    onSuccess: async (input) => {
      const messages = {
        request: `Friend request sent to ${input.name}.`,
        accept: `${input.name} is now your friend.`,
        decline: 'Friend request declined.',
        remove: `${input.name} was removed from your friends.`,
        block: `${input.name} was blocked.`,
      };
      toast('success', messages[input.type]);
      await refresh();
    },
    onError: (error) => toast('error', getApiErrorMessage(error, 'That action could not be completed.')),
  });

  const isLoading = friends.isLoading || requests.isLoading;
  const error = friends.error ?? requests.error;

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Your speaking circle</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">Friends</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Stay in touch with people you enjoyed practising English with.</p>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="find-people-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="find-people-title" className="font-display text-xl font-extrabold text-ink">Find people</h2><p className="mt-1 text-sm text-slate-500">Search by public handle or display name. Emails stay private.</p></div>
            <label className="block w-full sm:max-w-sm"><span className="sr-only">Search people</span><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search @handle or name" autoComplete="off" /></label>
          </div>
          {deferredSearch.length > 0 && deferredSearch.length < 2 && <p className="mt-4 text-xs font-semibold text-slate-400">Type at least 2 characters.</p>}
          {discovery.isFetching && <div className="mt-5 h-1 overflow-hidden rounded-full bg-brand-50"><motion.div className="h-full w-1/3 rounded-full bg-brand-500" animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 1.1 }} /></div>}
          {discovery.isError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{getApiErrorMessage(discovery.error, 'Search is unavailable right now.')}</p>}
          {discovery.data && <div className="mt-5 grid gap-3 md:grid-cols-2">{discovery.data.length ? discovery.data.map((person) => <SearchCard key={person.id} person={person} busy={action.isPending} onAction={(type) => action.mutate({ type, id: person.id, name: person.displayName })} />) : <p className="text-sm text-slate-500">No people matched that search.</p>}</div>}
        </section>

        {isLoading && <div className="mt-8"><PanelSkeleton rows={5} /></div>}
        {error && <div role="alert" className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{getApiErrorMessage(error, 'Could not load your friends.')}</div>}

        {!isLoading && !error && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section aria-labelledby="friends-title">
              <div className="flex items-center justify-between"><h2 id="friends-title" className="font-display text-2xl font-extrabold text-ink">Your friends</h2><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{friends.data?.length ?? 0}</span></div>
              {friends.data?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><AnimatePresence>{friends.data.map((friend) => <motion.article layout exit={{ opacity: 0, y: -8 }} key={friend.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><Avatar person={friend} online={friend.online} /><div className="min-w-0 flex-1"><p className="truncate font-bold text-ink">{friend.displayName}</p><p className="truncate text-xs font-semibold text-slate-400">@{friend.handle}</p></div></div><div className="mt-4 flex gap-2"><button type="button" className="secondary-button flex-1 !px-3 !py-2" disabled={action.isPending} onClick={() => action.mutate({ type: 'remove', id: friend.id, name: friend.displayName })}>Remove</button><button type="button" className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50" disabled={action.isPending} onClick={() => action.mutate({ type: 'block', id: friend.id, name: friend.displayName })}>Block</button></div></motion.article>)}</AnimatePresence></div> : <div className="mt-4"><EmptyState compact icon="＋" mood="encouraging" title="Build your circle" detail="Search above or add someone after a speaking session." /></div>}
            </section>

            <section aria-labelledby="requests-title">
              <div className="flex items-center justify-between"><h2 id="requests-title" className="font-display text-2xl font-extrabold text-ink">Requests</h2>{Boolean(requests.data?.incoming.length) && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{requests.data!.incoming.length} new</span>}</div>
              <div className="mt-4 space-y-3"><AnimatePresence initial={false}>{requests.data?.incoming.map((request) => <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }} key={request.id} className="rounded-2xl border border-brand-100 bg-white p-4"><div className="flex items-center gap-3"><Avatar person={request.user} /><div className="min-w-0 flex-1"><p className="truncate font-bold text-ink">{request.user.displayName}</p><p className="truncate text-xs font-semibold text-slate-400">@{request.user.handle}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className="primary-button !py-2" disabled={action.isPending} onClick={() => action.mutate({ type: 'accept', id: request.id, name: request.user.displayName })}>Accept</button><button type="button" className="secondary-button !py-2" disabled={action.isPending} onClick={() => action.mutate({ type: 'decline', id: request.id, name: request.user.displayName })}>Decline</button></div></motion.article>)}</AnimatePresence></div>
              {!requests.data?.incoming.length && <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5 text-sm text-slate-500">No incoming requests right now.</p>}
              {Boolean(requests.data?.outgoing.length) && <div className="mt-6"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Sent</h3><div className="mt-2 space-y-2">{requests.data!.outgoing.map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Avatar person={request.user} small /><div className="min-w-0"><p className="truncate text-sm font-bold text-ink">{request.user.displayName}</p><p className="truncate text-xs text-slate-400">Pending · @{request.user.handle}</p></div></div>)}</div></div>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function SearchCard({ person, busy, onAction }: { person: UserSearchResult; busy: boolean; onAction: (type: 'request' | 'accept' | 'block') => void }) {
  const labels = { NONE: 'Add friend', FRIEND: 'Friends', OUTGOING: 'Request sent', INCOMING: 'View request', BLOCKED: 'Unavailable' };
  return <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5"><Avatar person={person} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{person.displayName}</p><p className="truncate text-xs font-semibold text-slate-400">@{person.handle}</p></div><button type="button" className={person.relationship === 'NONE' ? 'primary-button !px-3 !py-2' : 'secondary-button !px-3 !py-2'} disabled={busy || person.relationship !== 'NONE'} onClick={() => onAction('request')}>{labels[person.relationship]}</button></article>;
}

function Avatar({ person, online, small = false }: { person: PublicProfile; online?: boolean; small?: boolean }) {
  return <span className={`relative grid shrink-0 place-items-center rounded-xl bg-brand-100 font-display font-extrabold text-brand-800 ${small ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm'}`}>{initials(person.displayName)}{online !== undefined && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${online ? 'bg-brand-500' : 'bg-slate-300'}`} aria-label={online ? 'Online' : 'Offline'} />}</span>;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}
