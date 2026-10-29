import React, { useEffect, useRef, useState } from 'react';
import { MODELS_DB } from '../utils/models';

export default function ModelAccessCheck({apiKey}:{apiKey:string}) {
  const [state,setState]=useState<'idle'|'loading'|'done'|'error'>('idle');
  const [available,setAvailable]=useState<string[]>([]);
  const [message,setMessage]=useState('');
  const sequence=useRef(0);
  useEffect(()=>{sequence.current++;setState('idle');setAvailable([]);setMessage('');return()=>{sequence.current++;};},[apiKey]);
  const verify=async()=>{
    const current=++sequence.current;
    setState('loading');setMessage('');
    try {
      const response=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${apiKey.trim()}`}});
      if(!response.ok)throw new Error(response.status===401?'Nieprawidłowy klucz API.':`Nie udało się odczytać listy modeli (HTTP ${response.status}).`);
      const body=await response.json();
      if(!Array.isArray(body.data))throw new Error('API nie zwróciło prawidłowej listy modeli.');
      if(current!==sequence.current)return;
      setAvailable(body.data.map((model:{id:string})=>model.id));setState('done');
    }catch(error){if(current!==sequence.current)return;setMessage(error instanceof Error?error.message:'Nie udało się połączyć z API.');setState('error');}
  };
  const matches=MODELS_DB.filter(model=>available.includes(model.id));
  return <div className="mt-2 text-[11px] leading-relaxed">
    <button type="button" disabled={!apiKey.trim()||state==='loading'} onClick={verify} className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600 hover:border-brand-400 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
      {state==='loading'?'Sprawdzanie…':'Sprawdź modele na koncie'}
    </button>
    <span className="ml-2 text-gray-500 dark:text-gray-400">Odczyt listy API, bez generowania tekstu.</span>
    {state==='error'&&<p role="status" className="mt-1 text-red-600 dark:text-red-400">{message}</p>}
    {state==='done'&&<details className="mt-1 text-gray-600 dark:text-gray-300"><summary className="cursor-pointer">Na liście konta: {matches.length} z {MODELS_DB.length} modeli katalogu</summary>
      <ul className="mt-1 list-inside list-disc">{MODELS_DB.map(model=><li key={model.id}>{model.name}: {available.includes(model.id)?'na liście konta':'brak na liście konta'}</li>)}</ul>
      <p className="mt-1">Lista potwierdza widoczność identyfikatora. Limity, środki na koncie i dostęp regionalny mogą dodatkowo wpływać na możliwość generowania.</p>
    </details>}
  </div>;
}
