export interface ModelDef {
  id: string;
  name: string;
  input: number; // Price per 1M tokens
  cachedInput: number; // Price per 1M cached tokens
  output: number; // Price per 1M tokens
}

export const MODELS_DB: ModelDef[] = [
  { 
    id: 'gpt-4o', 
    name: 'GPT-4o', 
    input: 2.50, cachedInput: 1.25, output: 10.00
  },
  { 
    id: 'gpt-4o-mini', 
    name: 'GPT-4o Mini', 
    input: 0.15, cachedInput: 0.075, output: 0.60
  },
  { 
    id: 'o1', 
    name: 'o1', 
    input: 15.00, cachedInput: 7.50, output: 60.00
  },
  { 
    id: 'o3-mini', 
    name: 'o3-mini', 
    input: 1.10, cachedInput: 0.55, output: 4.40
  }
];

export const getModelDef = (modelId: string): ModelDef => {
  const normalized = modelId.toLowerCase();
  return MODELS_DB.find(m => normalized.includes(m.id)) || MODELS_DB[0];
};

export const calculateSessionCost = (modelId: string, promptTokens: number, completionTokens: number): number => {
  const model = getModelDef(modelId);
  return (promptTokens / 1_000_000 * model.input) + (completionTokens / 1_000_000 * model.output);
};