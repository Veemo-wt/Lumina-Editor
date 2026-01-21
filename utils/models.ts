export interface ModelDef {
  id: string;
  name: string;
  input: number; // Price per 1M
  cachedInput: number; // Price per 1M
  output: number; // Price per 1M
  maxOutput: number; // Max output tokens
  context: string;
  desc?: string;
  tags?: ('balanced' | 'smart' | 'fast' | 'next-gen')[];
}

export const MODELS_DB: ModelDef[] = [
  // --- GPT-5 Series (Flagship) ---
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    input: 1.75, cachedInput: 0.85, output: 14.00,
    maxOutput: 128000,
    context: '400k',
    desc: 'Flagowiec. Najwyższa jakość korekty i analizy.',
    tags: ['balanced', 'next-gen']
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    input: 1.25, cachedInput: 0.60, output: 10.00,
    maxOutput: 128000,
    context: '400k',
    desc: 'Wysoka wydajność przy rozsądnej cenie.',
    tags: ['balanced']
  },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    input: 21.00, cachedInput: 10.50, output: 168.00,
    maxOutput: 128000,
    context: '400k',
    desc: 'Najwyższa jakość. Premium do wymagających korekt.',
    tags: ['smart', 'next-gen']
  },

  // --- GPT-4o Series (Standard) ---
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    input: 2.50, cachedInput: 1.25, output: 10.00,
    maxOutput: 16384,
    context: '128k',
    desc: 'Klasyk. Szybki i sprawdzony do ogólnej korekty.',
    tags: ['balanced']
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    input: 0.15, cachedInput: 0.075, output: 0.60,
    maxOutput: 16384,
    context: '128k',
    desc: 'Najtańszy. Dobry do prostych błędów ortograficznych.',
    tags: ['fast']
  },

  // --- o1 Series (Reasoning) ---
  {
    id: 'o1',
    name: 'o1',
    input: 15.00, cachedInput: 7.50, output: 60.00,
    maxOutput: 65536,
    context: '128k',
    desc: 'Model rezonujący. Najlepszy do złożonej analizy logicznej.',
    tags: ['smart']
  },
];

export const getModelDef = (modelId: string): ModelDef => {
  const normalized = modelId.toLowerCase();
  // Fuzzy match or exact match
  return MODELS_DB.find(m => normalized === m.id) ||
    MODELS_DB.find(m => normalized.includes(m.id)) ||
    MODELS_DB[0];
};

export const calculateSessionCost = (modelId: string, promptTokens: number, completionTokens: number): number => {
  const model = getModelDef(modelId);
  return (promptTokens / 1_000_000 * model.input) + (completionTokens / 1_000_000 * model.output);
};