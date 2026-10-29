import React, { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { APP_CHANGELOG } from '../utils/appChangelog';
import OrthographyGuide from './OrthographyGuide';

export default function ChangelogButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [view, setView] = useState<'changes' | 'orthography'>('changes');

  const openChangelog = () => {
    setView('changes');
    dialog.current?.showModal();
    dialog.current?.scrollTo(0, 0);
  };

  const navigate = (next: 'changes' | 'orthography') => {
    setView(next);
    dialog.current?.scrollTo(0, 0);
  };

  return (
    <>
      <button type="button" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-3 text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900 dark:focus-visible:ring-offset-gray-950" onClick={openChangelog} title="Nowe funkcje i historia zmian w Luminie" aria-label="Co nowego — historia zmian w aplikacjach Lumina" aria-haspopup="dialog">
        <Sparkles size={16} aria-hidden="true" />
        <span className="text-xs font-medium">Co nowego</span>
      </button>
      <dialog data-lumina-window="" ref={dialog} aria-labelledby={headingId} className="m-auto w-[min(54rem,calc(100%_-_2rem))] max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-0 text-gray-800 shadow-xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="min-w-0">
            {view === 'orthography' && (
              <button type="button" onClick={() => navigate('changes')} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300"><ArrowLeft size={14} aria-hidden="true" />Wszystkie zmiany</button>
            )}
            <h2 id={headingId} className="text-lg font-bold">{view === 'changes' ? 'Co nowego w Luminie' : 'Pisownia 2026 — zasady i przykłady'}</h2>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Zamknij okno aktualizacji" className="shrink-0 rounded-lg p-2 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        {view === 'orthography' ? <OrthographyGuide /> : (
          <div className="space-y-7 p-6 text-sm leading-relaxed">
            <p className="text-gray-600 dark:text-gray-300">Nowe funkcje i ulepszenia w aplikacjach Lumina — od najnowszej aktualizacji.</p>
            {APP_CHANGELOG.map((release, index) => (
              <section key={release.id} aria-labelledby={`${headingId}-${release.id}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <time dateTime={release.date} className="font-medium text-gray-500 dark:text-gray-400">{new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' }).format(new Date(`${release.date}T12:00:00Z`))}</time>
                  {index === 0 && <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">Najnowsza aktualizacja</span>}
                </div>
                <h3 id={`${headingId}-${release.id}`} className="mb-4 text-base font-bold">{release.title}</h3>
                <ul className="space-y-3">
                  {release.changes.map(change => (
                    <li key={change.title} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                      <span className={`mb-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${change.type === 'Nowość' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'}`}>{change.type}</span>
                      <h4 className="mb-1 font-semibold">{change.title}</h4>
                      <p className="text-gray-600 dark:text-gray-300">{change.description}</p>
                      {change.details === 'orthography' && <button type="button" onClick={() => navigate('orthography')} className="mt-3 inline-flex items-center gap-2 font-medium text-indigo-600 hover:underline dark:text-indigo-300">Zobacz zasady i przykłady<ArrowRight size={15} aria-hidden="true" /></button>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </dialog>
    </>
  );
}
