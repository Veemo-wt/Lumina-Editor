import React, { useState } from 'react';
import { ORTHOGRAPHY_SOURCES, ORTHOGRAPHY_VERIFIED_ON, POLISH_ORTHOGRAPHY_RULES } from '../utils/polishOrthography';

export default function OrthographyGuide() {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('pl');
  const rules = POLISH_ORTHOGRAPHY_RULES.filter(rule =>
    [rule.title, rule.rule, rule.caution, ...rule.examples].join(' ').toLocaleLowerCase('pl').includes(normalizedQuery)
  );

  return (
        <div className="space-y-5 p-6 text-sm leading-relaxed">
          <p>Norma obowiązuje od 1 stycznia 2026 r. Poniżej znajdziesz wszystkie grupy zmian z komunikatu RJP oraz informację o wycofanej zmianie nazw geograficznych.</p>
          <label className="block font-medium">
            Szukaj reguły lub przykładu
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="np. nie, pół, nagrody…" className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          </label>
          <p aria-live="polite" className="text-xs text-gray-500 dark:text-gray-400">Widoczne reguły: {rules.length} / {POLISH_ORTHOGRAPHY_RULES.length}</p>
          {rules.map(rule => (
            <section key={rule.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="mb-2 font-bold">{rule.title} <span className="font-normal text-gray-500 dark:text-gray-400">(RJP {rule.reference})</span></h3>
              <p>{rule.rule}</p>
              <ul className="my-3 list-disc space-y-1 pl-5">{rule.examples.map(example => <li key={example}>{example}</li>)}</ul>
              <p className="text-gray-600 dark:text-gray-300"><strong>Uwaga:</strong> {rule.caution}</p>
            </section>
          ))}
          {rules.length === 0 && <p>Brak pasujących reguł. Spróbuj innego hasła.</p>}
          <footer className="space-y-2 border-t border-gray-200 pt-4 text-xs dark:border-gray-700">
            <p>Źródła i weryfikacja: {ORTHOGRAPHY_VERIFIED_ON}. Objaśnienia i przykłady opracowano na podstawie dokumentów RJP.</p>
            {ORTHOGRAPHY_SOURCES.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-indigo-600 underline dark:text-indigo-400">{source.title}</a>)}
          </footer>
        </div>
  );
}
