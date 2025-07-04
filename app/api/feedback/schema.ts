import { z } from 'zod';

const textPartSchema = z.object({
    text: z.string().min(1).max(2000),
    type: z.enum(['text']),
});

export const postRequestBodySchema = z.object({
    id: z.string().uuid(),
    messages: z.array(
        z.object({
            role: z.enum(['user']),
            content: z.string().min(0).max(2000),
            parts: z.array(z.any()),
            data: z.object({
                chatId: z.string().uuid(),
                messageId: z.string().uuid(),
                language: z.string().min(1).max(10)
            }),

        })
    ),

});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
