import { Link } from 'react-router-dom';

export function WaitingPlaceholderPage() {
  return <main className="grid min-h-[70vh] place-items-center px-5"><div className="text-center"><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Matchmaking</p><h1 className="mt-3 font-display text-3xl font-extrabold">Waiting flow coming next</h1><Link className="secondary-button mt-6" to="/">Back home</Link></div></main>;
}
