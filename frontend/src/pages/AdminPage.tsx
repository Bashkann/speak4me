import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  closeAdminRoom,
  createAdminTopic,
  deleteAdminTopic,
  getAdminReports,
  getAdminRooms,
  getAdminStats,
  getAdminTopics,
  getAdminUsers,
  resolveAdminReport,
  updateAdminTopic,
  updateAdminUser,
  type AdminTopic,
  type TopicLevel,
} from '../api/admin';
import { getApiErrorMessage } from '../lib/api-error';
import { useToastStore } from '../store/toast-store';
import { EmptyState } from '../components/EmptyState';
import { PanelSkeleton, Skeleton } from '../components/LoadingSkeleton';
import { AnimatedNumber } from '../components/AnimatedNumber';

type AdminTab = 'overview' | 'users' | 'rooms' | 'reports' | 'topics';
const tabs: Array<[AdminTab, string]> = [['overview', 'Overview'], ['users', 'Users'], ['rooms', 'Rooms'], ['reports', 'Reports'], ['topics', 'Topics']];

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('overview');
  return (
    <main className="px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] bg-ink px-6 py-8 text-white shadow-soft sm:px-9"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-200">Administration</p><h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Community control room</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Monitor the community, keep rooms healthy, and manage conversation content.</p></section>
        <nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Admin sections">{tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === value ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-ink'}`}>{label}</button>)}</nav>
        <AnimatePresence mode="wait" initial={false}><motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-6">{tab === 'overview' && <Overview />}{tab === 'users' && <Users />}{tab === 'rooms' && <Rooms />}{tab === 'reports' && <Reports />}{tab === 'topics' && <Topics />}</motion.div></AnimatePresence>
      </div>
    </main>
  );
}

function Overview() {
  const query = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminStats, refetchInterval: 15_000 });
  if (query.isError) return <ErrorPanel error={query.error} />;
  if (query.isLoading) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Loading admin statistics">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><Skeleton className="h-10 w-20" /><Skeleton className="mt-3 h-3 w-28" /></div>)}</div>;
  const cards = [['Total users', query.data?.users ?? 0], ['Active rooms', query.data?.activeRooms ?? 0], ['Sessions today', query.data?.sessionsToday ?? 0], ['Queue length', query.data?.queueLength ?? 0]] as const;
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value], index) => <motion.article key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="font-display text-3xl font-extrabold tabular-nums text-ink sm:text-4xl"><AnimatedNumber value={value} /></p><p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p></motion.article>)}</div>;
}

function Users() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.add);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['admin-users', page, q], queryFn: () => getAdminUsers(page, q) });
  const update = useMutation({ mutationFn: ({ id, input }: { id: string; input: { role?: 'USER' | 'ADMIN'; suspended?: boolean } }) => updateAdminUser(id, input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-users'] }); addToast('success', 'User updated.'); } });
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(1); setQ(searchInput.trim()); };
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><form onSubmit={submit} className="flex gap-2"><input className="field" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name or email" aria-label="Search users" /><button className="secondary-button" type="submit">Search</button></form>{query.isError && <ErrorPanel error={query.error} />}{query.isLoading && <div className="mt-5"><PanelSkeleton rows={4} /></div>}{query.data?.items.length === 0 && <div className="mt-5"><EmptyState compact icon="⌕" mood="searching" prop="work" title="No users found" detail={q ? `No account matches “${q}”. Try a different name or email.` : 'No user accounts are available yet.'} /></div>}{query.data && query.data.items.length > 0 && <><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400"><tr><th className="pb-3">User</th><th className="pb-3">Level</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3 text-right">Actions</th></tr></thead><tbody>{query.data.items.map((user) => <tr key={user.id} className="border-b border-slate-100 last:border-0"><td className="py-4"><p className="font-bold text-ink">{user.displayName}</p><p className="text-xs text-slate-400">{user.email}</p></td><td className="py-4 font-bold text-slate-600">{user.englishLevel}</td><td className="py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{user.role}</span></td><td className="py-4"><span className={`text-xs font-bold ${user.suspendedAt ? 'text-red-600' : 'text-brand-700'}`}>{user.suspendedAt ? 'Suspended' : 'Active'}</span></td><td className="py-4 text-right"><div className="inline-flex gap-2"><button type="button" className="secondary-button !px-3 !py-2 text-xs" onClick={() => update.mutate({ id: user.id, input: { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' } })}>{user.role === 'ADMIN' ? 'Make user' : 'Make admin'}</button><button type="button" className={`rounded-xl px-3 py-2 text-xs font-bold ${user.suspendedAt ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`} onClick={() => update.mutate({ id: user.id, input: { suspended: !user.suspendedAt } })}>{user.suspendedAt ? 'Unsuspend' : 'Suspend'}</button></div></td></tr>)}</tbody></table></div><Pager page={page} total={query.data.total} limit={query.data.limit} onPage={setPage} /></>}</section>;
}

function Rooms() {
  const queryClient = useQueryClient(); const addToast = useToastStore((state) => state.add);
  const query = useQuery({ queryKey: ['admin-rooms'], queryFn: getAdminRooms, refetchInterval: 10_000 });
  const close = useMutation({ mutationFn: closeAdminRoom, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-rooms'] }); addToast('success', 'Room closed.'); } });
  if (query.isError) return <ErrorPanel error={query.error} />;
  if (query.isLoading) return <div className="grid gap-4 md:grid-cols-2"><PanelSkeleton rows={2} /><PanelSkeleton rows={2} /></div>;
  if (query.data?.length === 0) return <Empty title="No active rooms" detail="The room list will update automatically." />;
  return <div className="grid gap-4 md:grid-cols-2">{query.data?.map((room) => <article key={room.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-display text-xl font-extrabold text-ink">Room {room.code}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-brand-700">{room.type} · {room.status}</p></div><button type="button" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700" onClick={() => close.mutate(room.id)}>Force close</button></div><div className="mt-4 grid grid-cols-2 gap-2">{room.participants.map((participant) => <div key={participant.userId} className="rounded-xl bg-slate-50 p-3"><p className="truncate text-sm font-bold text-ink">{participant.user.displayName}</p><p className="mt-1 text-xs text-slate-400">Seat {participant.seat} · {participant.user.englishLevel}</p></div>)}</div></article>)}</div>;
}

function Reports() {
  const queryClient = useQueryClient(); const addToast = useToastStore((state) => state.add);
  const query = useQuery({ queryKey: ['admin-reports'], queryFn: getAdminReports });
  const resolve = useMutation({ mutationFn: (id: string) => resolveAdminReport(id), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-reports'] }); addToast('success', 'Report resolved.'); } });
  if (query.isError) return <ErrorPanel error={query.error} />;
  if (query.isLoading) return <div className="space-y-3"><PanelSkeleton rows={2} /><PanelSkeleton rows={2} /></div>;
  if (query.data?.length === 0) return <Empty title="No reports" detail="Community reports will appear here." />;
  return <div className="space-y-3">{query.data?.map((report) => <article key={report.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${report.resolvedAt ? 'border-slate-200 opacity-60' : 'border-amber-200'}`}><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-sm font-extrabold text-ink">{report.reporter.displayName} reported {report.reportedUser.displayName}</p><p className="mt-2 text-sm leading-6 text-slate-600">{report.reason}</p><p className="mt-2 text-xs text-slate-400">Room {report.roomId.slice(0, 8)} · {new Date(report.createdAt).toLocaleString()}</p></div>{!report.resolvedAt && <button type="button" className="primary-button h-fit shrink-0 !py-2" onClick={() => resolve.mutate(report.id)}>Resolve</button>}</div></article>)}</div>;
}

function Topics() {
  const queryClient = useQueryClient(); const addToast = useToastStore((state) => state.add);
  const [textEn, setTextEn] = useState(''); const [level, setLevel] = useState<TopicLevel>('ALL');
  const query = useQuery({ queryKey: ['admin-topics'], queryFn: getAdminTopics });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin-topics'] });
  const create = useMutation({ mutationFn: () => createAdminTopic({ textEn, level }), onSuccess: () => { setTextEn(''); refresh(); addToast('success', 'Topic created.'); } });
  const update = useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Pick<AdminTopic, 'textEn' | 'level' | 'isActive'>> }) => updateAdminTopic(id, input), onSuccess: refresh });
  const remove = useMutation({ mutationFn: deleteAdminTopic, onSuccess: refresh });
  return <div className="grid gap-5 lg:grid-cols-[340px_1fr]"><section className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-display text-xl font-extrabold text-ink">Add a topic</h2><textarea className="field mt-4 min-h-28 resize-y" value={textEn} onChange={(event) => setTextEn(event.target.value)} placeholder="Conversation prompt" /><select className="field mt-3" value={level} onChange={(event) => setLevel(event.target.value as TopicLevel)}>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'ALL'].map((value) => <option key={value}>{value}</option>)}</select><button type="button" className="primary-button mt-3 w-full" disabled={textEn.trim().length < 3 || create.isPending} onClick={() => create.mutate()}>{create.isPending && <span className="inline-spinner" />}Add topic</button></section><section className="space-y-2">{query.isError && <ErrorPanel error={query.error} />}{query.isLoading && <><PanelSkeleton rows={2} /><PanelSkeleton rows={2} /></>}{query.data?.length === 0 && <EmptyState compact icon="✦" title="No topics yet" detail="Add the first conversation prompt to start the library." />}{query.data?.map((topic) => <TopicRow key={topic.id} topic={topic} onSave={(input) => update.mutate({ id: topic.id, input })} onDelete={() => remove.mutate(topic.id)} />)}</section></div>;
}

function TopicRow({ topic, onSave, onDelete }: { topic: AdminTopic; onSave: (input: Partial<Pick<AdminTopic, 'textEn' | 'level' | 'isActive'>>) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false); const [textEn, setTextEn] = useState(topic.textEn); const [level, setLevel] = useState(topic.level);
  return <article className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${topic.isActive ? '' : 'opacity-55'}`}>{editing ? <div><textarea className="field min-h-20" value={textEn} onChange={(event) => setTextEn(event.target.value)} /><div className="mt-2 flex gap-2"><select className="field !w-28" value={level} onChange={(event) => setLevel(event.target.value as TopicLevel)}>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'ALL'].map((value) => <option key={value}>{value}</option>)}</select><button type="button" className="primary-button flex-1 !py-2" onClick={() => { onSave({ textEn, level }); setEditing(false); }}>Save</button><button type="button" className="secondary-button !py-2" onClick={() => setEditing(false)}>Cancel</button></div></div> : <div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-extrabold text-brand-700">{topic.level}</span><p className="mt-2 text-sm font-semibold leading-6 text-ink">{topic.textEn}</p></div><div className="flex shrink-0 gap-1"><button type="button" className="secondary-button !px-3 !py-2 text-xs" onClick={() => setEditing(true)}>Edit</button><button type="button" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700" onClick={() => onSave({ isActive: !topic.isActive })}>{topic.isActive ? 'Disable' : 'Enable'}</button><button type="button" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700" onClick={onDelete}>Delete</button></div></div>}</article>;
}

function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (page: number) => void }) { const pages = Math.max(1, Math.ceil(total / limit)); return <div className="mt-5 flex items-center justify-center gap-3"><button className="secondary-button !py-2" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span className="text-xs font-bold text-slate-400">{page} / {pages}</span><button className="secondary-button !py-2" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></div>; }
function ErrorPanel({ error }: { error: unknown }) { return <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{getApiErrorMessage(error, 'Could not load admin data.')}</div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <EmptyState icon={title.includes('rooms') ? '◌' : '✓'} mood={title.includes('rooms') ? 'thinking' : 'happy'} prop="work" title={title} detail={detail} />; }
