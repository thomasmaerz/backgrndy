import { AIProvider } from './provider';
import { GeminiProvider } from './gemini';

function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'gemini';
  
  switch (provider) {
    case 'gemini':
      return new GeminiProvider();
    default:
      return new GeminiProvider();
  }
}

export const aiProvider = getAIProvider();
