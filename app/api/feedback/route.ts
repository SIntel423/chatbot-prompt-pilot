import { auth } from "@/app/[locale]/(auth)/auth";
import { systemPromptForFeedback } from "@/lib/ai/prompts";
import { isProductionEnvironment } from "@/lib/constants";
import { createStreamId, getChatById, getMessageById, getMessagesByChatId, getStreamIdsByChatId, saveFeedback, saveMessages } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID, getTrailingMessageId } from "@/lib/utils";
import { openai } from "@ai-sdk/openai";
import { appendResponseMessages, createDataStream, smoothStream, streamText } from "ai";
import { RollerCoaster } from "lucide-react";
import { after } from "next/server";
import { createResumableStreamContext, ResumableStreamContext } from "resumable-stream";
import { PostRequestBody, postRequestBodySchema } from "./schema";
import { Chat } from "@/lib/db/schema";
import { differenceInSeconds } from "date-fns";

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
    let requestBody: PostRequestBody;
    try {
        const json = await request.json();

        requestBody = postRequestBodySchema.parse(json);
        console.log(' > Request body:', requestBody);
    } catch (_) {
        return new ChatSDKError('bad_request:api').toResponse();
    }
    const { id: chatId, messages } =
        requestBody;

    const messageId = messages[0].data.messageId;
    const language = messages[0].data.language;

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
                    system: systemPromptForFeedback({ language }),
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
        if (streamContext) {
            console.log(' > Resumable stream context found, using it');
            return new Response(
                await streamContext.resumableStream(streamId, () => { console.log(stream); return stream }),
            );
        } else {
            console.log(' > not resumable ');
            return new Response(stream);
        }
    }
    catch (error) {
        if (error instanceof ChatSDKError) {
            return error.toResponse();
        }
    }
}

export async function GET(request: Request) {
    const streamContext = getStreamContext();
    const resumeRequestedAt = new Date();

    if (!streamContext) {
        return new Response(null, { status: 204 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
        return new ChatSDKError('bad_request:api').toResponse();
    }

    const session = await auth();

    if (!session?.user) {
        return new ChatSDKError('unauthorized:chat').toResponse();
    }

    let chat: Chat;

    try {
        chat = await getChatById({ id: chatId });
    } catch {
        return new ChatSDKError('not_found:chat').toResponse();
    }

    if (!chat) {
        return new ChatSDKError('not_found:chat').toResponse();
    }

    if (chat.visibility === 'private' && chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
    }

    const streamIds = await getStreamIdsByChatId({ chatId });

    if (!streamIds.length) {
        return new ChatSDKError('not_found:stream').toResponse();
    }

    const recentStreamId = streamIds.at(-1);

    if (!recentStreamId) {
        return new ChatSDKError('not_found:stream').toResponse();
    }

    const emptyDataStream = createDataStream({
        execute: () => { },
    });

    const stream = await streamContext.resumableStream(
        recentStreamId,
        () => emptyDataStream,
    );

    if (!stream) {
        const messages = await getMessagesByChatId({ id: chatId });
        const mostRecentMessage = messages.at(-1);

        if (!mostRecentMessage) {
            return new Response(emptyDataStream, { status: 200 });
        }

        if (mostRecentMessage.role !== 'assistant') {
            return new Response(emptyDataStream, { status: 200 });
        }

        const messageCreatedAt = new Date(mostRecentMessage.createdAt);

        if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
            return new Response(emptyDataStream, { status: 200 });
        }

        const restoredStream = createDataStream({
            execute: (buffer) => {
                buffer.writeData({
                    type: 'append-message',
                    message: JSON.stringify(mostRecentMessage),
                });
            },
        });

        return new Response(restoredStream, { status: 200 });
    }

    return new Response(stream, { status: 200 });
}