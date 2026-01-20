import OpenAI from 'openai';
import { RagEntry } from '../types';

/**
 * Calculates Cosine Similarity between two vectors.
 * Returns a value between -1 and 1 (1 being identical direction).
 */
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const generateEmbedding = async (text: string, apiKey: string): Promise<number[]> => {
  if (!text || !text.trim()) return [];
  
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  
  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small", // High performance, low cost
      input: text.replace(/\n/g, ' '), // Normalize newlines
    });
    return response.data[0].embedding;
  } catch (error) {
    console.warn("Embedding generation failed", error);
    return [];
  }
};

export const findSimilarSegments = async (
  queryText: string, 
  entries: RagEntry[], 
  apiKey: string,
  topK: number = 3,
  threshold: number = 0.4
): Promise<RagEntry[]> => {
  if (entries.length === 0) return [];

  // 1. Generate vector for current query
  const queryVector = await generateEmbedding(queryText, apiKey);
  if (queryVector.length === 0) return [];

  // 2. Score all entries
  const scored = entries.map(entry => ({
    ...entry,
    score: cosineSimilarity(queryVector, entry.vector)
  }));

  // 3. Filter & Sort
  return scored
    .filter(e => e.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

export const createRagEntry = async (
  sourceText: string,
  translatedText: string,
  apiKey: string,
  origin: string
): Promise<RagEntry | null> => {
  const vector = await generateEmbedding(sourceText, apiKey);
  if (vector.length === 0) return null;

  return {
    id: Date.now().toString() + Math.random().toString().slice(2, 6),
    sourceText,
    translatedText,
    vector,
    sourceOrigin: origin
  };
};