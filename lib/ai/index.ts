import { getConfig } from '@/lib/config'
import { AIProvider, Message } from './provider'
import { GeminiProvider } from './gemini'

export type { AIProvider, Message }

export function getAIProvider(): AIProvider {
  const config = getConfig()
  
  switch (config.ai.provider) {
    case 'gemini':
      return new GeminiProvider()
    default:
      return new GeminiProvider()
  }
}
