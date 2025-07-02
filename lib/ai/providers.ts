import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

export const myProvider = isTestEnvironment
  ? customProvider({
    languageModels: {
      'chat-model': chatModel,
      'chat-model-reasoning': reasoningModel,
      'title-model': titleModel,
      'artifact-model': artifactModel,
    },
  })
  : customProvider({
    languageModels: {
      'chat-model': openai('gpt-4o'), // ✅ GPT-4o or gpt-3.5-turbo
      'chat-model-reasoning': wrapLanguageModel({
        model: openai('gpt-4o'), // ✅ still OpenAI
        middleware: extractReasoningMiddleware({ tagName: 'think' }),
      }),
      'title-model': openai('gpt-3.5-turbo'), // or gpt-4o, etc.
      'artifact-model': openai('gpt-3.5-turbo'),
    },
  });
