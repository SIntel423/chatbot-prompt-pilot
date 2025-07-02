import { auth } from "@/app/(auth)/auth";
import { systemPromptForFeedback } from "@/lib/ai/prompts";
import { isProductionEnvironment } from "@/lib/constants";
import { createStreamId, getChatById, getMessageById, saveFeedback, saveMessages } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID, getTrailingMessageId } from "@/lib/utils";
import { openai } from "@ai-sdk/openai";
import { appendResponseMessages, createDataStream, smoothStream, streamText } from "ai";
import { RollerCoaster } from "lucide-react";
import { after } from "next/server";
import { createResumableStreamContext, ResumableStreamContext } from "resumable-stream";

let globalStreamContext: ResumableStreamContext | null = null;
function getStreamContext() {
    if (!globalStreamContext) {
        try {
            globalStreamContext = createResumableStreamContext({
                waitUntil: after,
            });
        } catch (error: any) {
            if (error.message.includes('REDIS_URL')) {
                console.log(
                    ' > Resumable streams are disabled due to missing REDIS_URL',
                );
            } else {
                console.error(error);
            }
        }
    }

    return globalStreamContext;
}

export const maxDuration = 60;
export async function POST(request: Request) {
    const {
        chatId,
        messageId,
    }: { chatId: string; messageId: string } =
        await request.json();

    if (!chatId || !messageId) {
        return new ChatSDKError(
            'bad_request:api',
            'Parameters chatId, messageId are required.',
        ).toResponse();
    }

    const session = await auth();

    if (!session?.user) {
        return new ChatSDKError('unauthorized:feedback').toResponse();
    }

    const message = await getMessageById({ id: messageId });

    if (!message) {
        return new ChatSDKError('not_found:feedback').toResponse();
    }

    const parts = message[0].parts;
    let content: string | undefined = undefined;
    if (Array.isArray(parts) && parts[0] && typeof parts[0] === "object" && "text" in parts[0]) {
        content = (parts[0] as { text?: string }).text;
    }
    console.log(content)

    if (!content) {
        return new ChatSDKError('bad_request:api', 'Message content is missing or invalid.').toResponse();
    }

    try {
        const streamId = generateUUID();
        await createStreamId({ streamId, chatId: chatId });

        const stream = createDataStream({
            execute: (dataStream) => {
                const result = streamText({
                    model: openai('gpt-4o'),
                    system: systemPromptForFeedback(),
                    messages: [
                        {
                            role: 'user',
                            content: content,
                        }
                    ],
                    experimental_transform: smoothStream({ chunking: 'word' }),
                    experimental_generateMessageId: generateUUID,

                    onFinish: async ({ response }) => {
                        if (session.user?.id) {

                            try {
                                const assistantId = getTrailingMessageId({
                                    messages: response.messages.filter(
                                        (message) => message.role === 'assistant',
                                    ),
                                });

                                if (!assistantId) {
                                    throw new Error('No assistant message found!');
                                }

                                const [, assistantMessage] = appendResponseMessages({
                                    messages: [
                                        {
                                            id: generateUUID(),
                                            content: content,
                                            role: 'user',
                                            createdAt: new Date(),
                                            parts: [
                                                { text: content, type: 'text' }
                                            ]
                                        }
                                    ],
                                    responseMessages: response.messages,
                                });


                                await saveFeedback({
                                    messages: [
                                        {
                                            id: generateUUID(),
                                            messageId: messageId,
                                            chatId: chatId,
                                            contents: assistantMessage.parts,
                                            createdAt: new Date(),
                                        },
                                    ],
                                });
                            } catch (e) {
                                console.error('Failed to save feedback' + e);
                            }
                        }
                    },
                    experimental_telemetry: {
                        isEnabled: isProductionEnvironment,
                        functionId: 'stream-text',
                    },
                });
                console.log(' > Streaming started', result);
                result.consumeStream();

                result.mergeIntoDataStream(dataStream, {
                    sendReasoning: true,
                });
            },
            onError: () => {
                return 'Oops, an error occurred!';
            },
        });


        const streamContext = getStreamContext();
        console.log("streamContext:" + streamContext)
        if (streamContext) {
            return new Response(
                await streamContext.resumableStream(streamId, () => stream),
            );
        } else {
            return new Response(stream);
        }
    }
    catch (error) {
        if (error instanceof ChatSDKError) {
            return error.toResponse();
        }
    }
}