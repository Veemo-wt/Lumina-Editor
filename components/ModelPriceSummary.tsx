import React from 'react';
import { ModelDef, ModelPricing } from '../utils/models';

const amount = (value: number) => `$${value.toLocaleString('en-US',{maximumFractionDigits:3})}`;
export default function ModelPriceSummary({model}:{model:ModelDef}) {
  const line = (label:string, pricing:ModelPricing) => (
    <div key={label}>
      <span className="font-semibold">{label}</span> {amount(pricing.input)} wejście · {amount(pricing.output)} wyjście
      {model.id !== 'gpt-5.2-pro' && <div className="opacity-90">Cache: {amount(pricing.cachedInput)}{pricing.cacheWrite !== undefined && ` · zapis 30m: ${amount(pricing.cacheWrite)}`}{pricing.cacheWrite12h !== undefined && ` · 12h: ${amount(pricing.cacheWrite12h)}`}</div>}
    </div>
  );
  return <div className="my-2 space-y-1 rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[9px] leading-relaxed text-gray-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300" aria-label="Ceny USD za milion tokenów">
    {line(model.longContextPricing ? 'Standard ≤272k:' : 'Za 1M tokenów:',model)}
    {model.longContextPricing && line('Kontekst >272k:',model.longContextPricing)}
  </div>;
}
