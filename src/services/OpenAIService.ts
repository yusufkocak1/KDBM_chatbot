// src/services/OpenAIService.ts
class OpenAIService {
    private apiKey: string;
    private baseUrl = 'https://api.openai.com/v1/chat/completions';

    constructor() {
        // API anahtarını çevre değişkeninden alın
        this.apiKey = process.env.REACT_APP_OPENAI_API_KEY || '';
        console.log("OpenAIService başlatıldı, API anahtarı var mı:", !!this.apiKey);

        // API anahtarı kontrolü
        if (!this.apiKey) {
            console.error('UYARI: OpenAI API anahtarı bulunamadı. Lütfen REACT_APP_OPENAI_API_KEY çevre değişkenini tanımlayın.');
        }
    }

    async sendMessage(messages: { role: string; content: string }[], options: {
        tools?: any[];
        onToolCall?: (toolName: string, args: any) => Promise<any>;
        signal?: AbortSignal;
    } = {}): Promise<string> {

        console.log("OpenAIService.sendMessage çağrıldı:", messages, options);

        // API anahtarı yoksa hata fırlat
        if (!this.apiKey) {
            const error = new Error('OpenAI API anahtarı tanımlanmamış. Lütfen .env dosyasında REACT_APP_OPENAI_API_KEY değişkenini tanımlayın.');
            console.error(error);
            throw error;
        }

        const requestBody = {
            model: 'gpt-4.1-nano',
            max_tokens: 1024,
            messages: messages,
            tools: options.tools?.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }
            })) || []
        };

        try {
            let messagesHistory = [...requestBody.messages];
            let tools = requestBody.tools;
            let model = requestBody.model;
            let max_tokens = requestBody.max_tokens || 1024;
            let responseData: any = null;
            let hasToolCall = false;
            do {
                // Fetch options içine signal ekle
                const fetchOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model,
                        messages: messagesHistory,
                        max_tokens,
                        tools
                    }),
                    signal: options.signal
                };

                const response = await fetch(this.baseUrl, fetchOptions);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`OpenAI API hatası: ${errorData.error?.message || response.statusText}`);
                }

                responseData = await response.json();

                // Araç çağrıları varsa işle
                if (responseData.choices && responseData.choices[0].message.tool_calls) {
                    hasToolCall = true;
                    const toolCalls = responseData.choices[0].message.tool_calls;
                    const results = [];

                    // Her bir tool call için signal iptal edilmiş mi kontrol et
                    for (const toolCall of toolCalls) {
                        if (options.signal?.aborted) {
                            throw new Error('İstek iptal edildi');
                        }

                        if (options.onToolCall) {
                            const toolName = toolCall.function.name;
                            const args = JSON.parse(toolCall.function.arguments);
                            const result = await options.onToolCall(toolName, args);
                            results.push({ toolName, result, tool_call_id: toolCall.id });
                        }
                    }

                    // Mesajlara tool sonuçlarını ve model mesajını sıralı ekle
                    messagesHistory = [
                        ...messagesHistory,
                        // Modelin tool_call mesajı (type: 'assistant')
                        {
                            role: 'assistant',
                            content: '', // content null yerine boş string
                            tool_calls: toolCalls
                        } as any, // TypeScript hatasını önlemek için geçici olarak any
                        // Her tool_call için tool cevabı
                        ...results.map(({ toolName, result, tool_call_id }) => ({
                            role: 'tool',
                            tool_call_id,
                            name: toolName,
                            content: JSON.stringify(result)
                        }) as any)
                    ];
                } else {
                    // Son model cevabını da geçmişe ekle
                    if (responseData.choices && responseData.choices[0].message) {
                        messagesHistory = [
                            ...messagesHistory,
                            responseData.choices[0].message
                        ];
                    }
                    hasToolCall = false;
                }
            } while (hasToolCall);

            // Normal yanıt durumu
            return responseData.choices[0].message.content;
        } catch (error) {
            // AbortError'ı tekrar fırlat
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
            }
            console.error('OpenAI API hatası:', error);
            throw error;
        }
    }
}

export const openAIService = new OpenAIService();
