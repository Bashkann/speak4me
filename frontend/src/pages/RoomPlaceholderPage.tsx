import { Link, useParams } from 'react-router-dom';

export function RoomPlaceholderPage() {
  const { roomId } = useParams();
  return <main className="grid min-h-[70vh] place-items-center px-5"><div className="text-center"><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Room created</p><h1 className="mt-3 font-display text-3xl font-extrabold">Realtime room coming next</h1><p className="mt-3 text-sm text-slate-500">Room ID: {roomId}</p><Link className="secondary-button mt-6" to="/">Back home</Link></div></main>;
}
