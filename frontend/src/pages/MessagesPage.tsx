import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getConversations, getMessages, markConversationRead, sendMessage, type Message, type MessageHistory } from '../api/chat';
import { EmptyState } from '../components/EmptyState';
import { PanelSkeleton } from '../components/LoadingSkeleton';
import { useChatRealtime } from '../components/ChatRealtimeProvider';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';

export function MessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const toast = useToastStore((state) => state.add);
  const realtime = useChatRealtime();
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState('');
  const typingTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: getConversations });
  const selected = conversations.data?.find((conversation) => conversation.id === conversationId);
  const messages = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId!),
    enabled: Boolean(conversationId),
  });

  const sender = useMutation({
    mutationFn: (body: string) => sendMessage(conversationId!, body),
    onSuccess: (message) => {
      queryClient.setQueryData<MessageHistory>(['messages', conversationId], (current) => current && !current.items.some((item) => item.id === message.id) ? { ...current, items: [...current.items, message] } : current);
      setDraft('');
      realtime.socket?.emit('typing', { conversationId, isTyping: false });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => toast('error', getApiErrorMessage(error, 'Your message could not be sent.')),
  });

  const older = useMutation({
    mutationFn: () => getMessages(conversationId!, messages.data?.nextBefore ?? undefined),
    onSuccess: (page) => queryClient.setQueryData<MessageHistory>(['messages', conversationId], (current) => current ? {
      items: [...page.items, ...current.items.filter((item) => !page.items.some((olderMessage) => olderMessage.id === item.id))],
      nextBefore: page.nextBefore,
    } : page),
  });

  useEffect(() => {
    if (!conversationId || !messages.data?.items.length) return;
    void markConversationRead(conversationId).then(() => {
      queryClient.setQueryData<Awaited<ReturnType<typeof getConversations>>>(['conversations'], (current) => current?.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
    });
  }, [conversationId, messages.data?.items.length, queryClient]);

  useEffect(() => {
    if (!messages.data?.items.length) return;
    bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'end' });
  }, [messages.data?.items.length, reducedMotion]);

  useEffect(() => () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (conversationId) realtime.socket?.emit('typing', { conversationId, isTyping: false });
  }, [conversationId, realtime.socket]);

  const updateDraft = (value: string) => {
    setDraft(value);
    if (!conversationId) return;
    realtime.socket?.emit('typing', { conversationId, isTyping: value.trim().length > 0 });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => realtime.socket?.emit('typing', { conversationId, isTyping: false }), 1_500);
  };

  const submit = () => {
    const body = draft.trim();
    if (body && conversationId && !sender.isPending) sender.mutate(body);
  };

  return (
    <main className="mx-auto h-[calc(100dvh-72px)] max-w-6xl overflow-hidden sm:px-8 sm:py-6">
      <div className="grid h-full overflow-hidden border-slate-200 bg-white sm:rounded-3xl sm:border sm:shadow-soft md:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`${conversationId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-slate-200`} aria-label="Conversations">
          <div className="border-b border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Stay connected</p><h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Messages</h1></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {conversations.isLoading && <PanelSkeleton rows={5} />}
            {conversations.isError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{getApiErrorMessage(conversations.error, 'Could not load conversations.')}</p>}
            {conversations.data?.length === 0 && <EmptyState compact icon="✉" mood="thinking" title="No conversations yet" detail="Open a chat from your Friends page." action={<button className="primary-button" onClick={() => navigate('/friends')}>Find friends</button>} />}
            <div className="space-y-1">{conversations.data?.map((conversation) => {
              const isOnline = realtime.online.get(conversation.partner.id);
              return <button type="button" key={conversation.id} onClick={() => navigate(`/messages/${conversation.id}`)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${conversation.id === conversationId ? 'bg-brand-50' : 'hover:bg-slate-50'}`}><Avatar name={conversation.partner.displayName} online={isOnline} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-ink">{conversation.partner.displayName}</p><time className="shrink-0 text-[10px] font-semibold text-slate-400">{conversation.lastMessage ? compactTime(conversation.lastMessage.createdAt) : ''}</time></div><div className="mt-1 flex items-center gap-2"><p className={`truncate text-xs ${conversation.unreadCount ? 'font-bold text-ink' : 'text-slate-500'}`}>{conversation.lastMessage?.body || 'Start the conversation'}</p>{conversation.unreadCount > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-extrabold text-white">{Math.min(conversation.unreadCount, 99)}</span>}</div></div></button>;
            })}</div>
          </div>
        </aside>

        <section className={`${conversationId ? 'flex' : 'hidden md:flex'} min-h-0 flex-col`} aria-label="Chat">
          {!conversationId ? <div className="grid h-full place-items-center p-8"><EmptyState icon="💬" mood="encouraging" title="Choose a conversation" detail="Select a friend to continue practising together." /></div> : (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5"><button type="button" onClick={() => navigate('/messages')} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-ink md:hidden" aria-label="Back to conversations">←</button>{selected && <><Avatar name={selected.partner.displayName} online={realtime.online.get(selected.partner.id)} /><div className="min-w-0"><h2 className="truncate font-bold text-ink">{selected.partner.displayName}</h2><p className="text-xs font-medium text-slate-400">{realtime.online.get(selected.partner.id) ? 'Online' : `@${selected.partner.handle}`}</p></div></>}</header>
              <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-4 py-5 sm:px-6">
                {messages.isLoading && <div className="space-y-3"><div className="h-12 w-2/3 animate-pulse rounded-2xl bg-slate-100" /><div className="ml-auto h-14 w-3/4 animate-pulse rounded-2xl bg-brand-100" /></div>}
                {messages.isError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{getApiErrorMessage(messages.error, 'Could not load messages.')}</p>}
                {messages.data?.nextBefore && <div className="mb-5 text-center"><button type="button" disabled={older.isPending} onClick={() => older.mutate()} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">{older.isPending ? 'Loading…' : 'Load older messages'}</button></div>}
                <div className="space-y-2"><AnimatePresence initial={false}>{messages.data?.items.map((message) => <MessageBubble key={message.id} message={message} own={message.senderId === user?.id} reducedMotion={Boolean(reducedMotion)} />)}</AnimatePresence></div>
                {realtime.typing.get(conversationId) && realtime.typing.get(conversationId) !== user?.id && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-400"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /><span className="ml-1">typing</span></motion.div>}
                <div ref={bottomRef} />
              </div>
              <form className="safe-bottom shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); submit(); }}><div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Message</span><textarea rows={1} value={draft} maxLength={2000} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Write a message…" className="field max-h-32 min-h-12 resize-none !py-3" /></label><button type="submit" disabled={!draft.trim() || sender.isPending} className="primary-button h-12 w-12 shrink-0 !p-0" aria-label="Send message">{sender.isPending ? <span className="inline-spinner" /> : '↑'}</button></div><p className="mt-1.5 text-right text-[10px] font-medium text-slate-400">{draft.length} / 2000</p></form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function MessageBubble({ message, own, reducedMotion }: { message: Message; own: boolean; reducedMotion: boolean }) {
  return <motion.article initial={{ opacity: 0, y: reducedMotion ? 0 : 7, x: reducedMotion ? 0 : own ? 8 : -8 }} animate={{ opacity: 1, y: 0, x: 0 }} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[70%] ${own ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-white text-ink'}`}><p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? 'text-brand-200' : 'text-slate-400'}`}><time dateTime={message.createdAt}>{compactTime(message.createdAt)}</time>{own && <span aria-label={message.readAt ? 'Read' : 'Sent'}>{message.readAt ? '✓✓' : '✓'}</span>}</div></div></motion.article>;
}

function Avatar({ name, online }: { name: string; online?: boolean }) { return <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 font-display text-xs font-extrabold text-brand-800">{initials(name)}{online !== undefined && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${online ? 'bg-brand-500' : 'bg-slate-300'}`} />}</span>; }
function initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'; }
function compactTime(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
