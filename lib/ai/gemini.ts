import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, Message } from './provider';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(messages: Message[]): Promise<string> {
    const model = this.client.getGenerativeModel({ model: 'gemini-3.1-flash' });

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: contents.slice(0, -1),
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response;
    
    return response.text();
  }
}
