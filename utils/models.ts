export interface ModelDef {
  id: string;
  name: string;
  input: number; // Price per 1M tokens
  cachedInput: number; // Price per 1M cached tokens
  output: number; // Price per 1M tokens
  maxOutput?: number; // Max output tokens
}

export const MODELS_DB: ModelDef[] = [
  { 
    id: 'gpt-5.2', 
    name: 'GPT-5.2', 
    input: 1.75, cachedInput: 0.85, output: 14.00,
    maxOutput: 128000
  },
  { 
    id: 'gpt-5.1', 
    name: 'GPT-5.1', 
    input: 1.25, cachedInput: 0.60, output: 10.00,
    maxOutput: 128000
  },
  { 
    id: 'gpt-5.2-pro', 
    name: 'GPT-5.2 Pro', 
    input: 21.00, cachedInput: 10.50, output: 168.00,
    maxOutput: 128000
  },
  { 
    id: 'gpt-4o', 
    name: 'GPT-4o', 
    input: 2.50, cachedInput: 1.25, output: 10.00,
    maxOutput: 4096 // Standard limit, though some versions go to 16k
  },
  { 
    id: 'gpt-4o-mini', 
    name: 'GPT-4o Mini', 
    input: 0.15, cachedInput: 0.075, output: 0.60,
    maxOutput: 16384
  },
  { 
    id: 'o1', 
    name: 'o1', 
    input: 15.00, cachedInput: 7.50, output: 60.00,
    maxOutput: 65536 // Variable, usually high
  }
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