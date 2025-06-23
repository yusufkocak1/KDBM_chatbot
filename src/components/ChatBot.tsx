// src/components/ChatBot.tsx
import React, { useState, useEffect, useRef } from 'react';
import { mcpService } from '../services/McpService';
import { openAIService } from '../services/OpenAIService';
import { ChatMessage } from "../types/mcp";

interface ChatBotProps {
    isConnected?: boolean;
}

const ChatBot: React.FC<ChatBotProps> = ({ isConnected = false }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // AI yanıt verdikten ve loading durumu bittiğinde input alanına odaklan
    useEffect(() => {
        // AI yanıt verdiğinde ve loading durumu false olduğunda input alanına odaklan
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && !isLoading) {
            focusInput();
        }
    }, [messages, isLoading]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Input alanına odaklanma fonksiyonu
    const focusInput = () => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            role: role === 'system' ? 'assistant' : role,
            content,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        // Eğer bağlantı yoksa, kullanıcıya bildiriyoruz
        if (!isConnected) {
            addMessage('system', 'MCP Server ile bağlantı kurulamadı. Lütfen bağlantıyı kontrol edin.');
            setInputMessage('');
            return;
        }

        const userMessage = inputMessage.trim();
        console.log("Kullanıcı mesajı gönderiliyor:", userMessage);
        setInputMessage('');
        addMessage('user', userMessage);
        setIsLoading(true);
        try {
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;
            console.log("OpenAIService.sendMessage çağrılmaya hazırlanıyor...");

            // OpenAI'ye mesajı gönder ve MCP araçlarını kullanmasını söyle
            const tools = await mcpService.getAvailableTools();
            console.log("MCP araçları alındı:", tools);

            // --- ÖNEMLİ: Önceki mesajları OpenAI'ye uygun formata çevir ---
            const openAIMessages = messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            // Son kullanıcı mesajını da ekle
            openAIMessages.push({ role: 'user', content: userMessage });

            console.log("OpenAIService.sendMessage çağrılıyor...");
            const response = await openAIService.sendMessage(openAIMessages, {
                tools,
                onToolCall: async (toolName: string, args: any) => {
                    console.log(`Tool çağrılıyor: ${toolName}`, args);
                    if (signal.aborted) {
                        throw new Error('İstek iptal edildi');
                    }
                    try {
                        const result = await mcpService.callTool(toolName, args);
                        console.log(`Tool sonucu: ${toolName}`, result);
                        return result;
                    } catch (err: any) {
                        // MCP'den hata alınırsa işlemi kes ve hata mesajını göster
                        console.error(`MCP hatası (${toolName}):`, err);

                        // Hata mesajını kullanıcıya göstermek için assistant mesajı ekle
                        const errorMessage = `MCP Hatası (${toolName}): ${err.message}`;
                        addMessage('assistant', errorMessage);

                        // İşlemi durdur
                        setIsLoading(false);
                        abortControllerRef.current?.abort();
                        throw new Error(errorMessage);
                    }
                },
                signal
            });
            console.log("OpenAI yanıtı alındı:", response);

            addMessage('assistant', response);
        } catch (error : any) {
            console.error("Hata oluştu:", error);
            if (error.name === 'AbortError' || error.message === 'İstek iptal edildi') {
                addMessage('system', 'İstek kullanıcı tarafından durduruldu.');
            } else {
                addMessage('assistant', 'Üzgünüm, bir hata oluştu: ' + error.message);
            }
        } finally {
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    const handleStopResponse = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const renderMessageContent = (content: string | null | undefined) => {
        if (content === null || content === undefined) {
            return { __html: '' }; // Null veya undefined içeriği boş string olarak işle
        }
        return { __html: content.replace(/\n/g, '<br>') };
    };

    // Giriş alanının yüksekliğini içeriğe göre otomatik ayarlama
    const autoResizeTextarea = () => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    };

    return (
        <div className="chatbot-container">
            <div className="messages-container">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <h2>KDBM Veritabanı Asistanına Hoş Geldiniz</h2>
                        <p>Veritabanınız hakkında sorular sorabilir, verilerinizi analiz edebilir ve SQL sorguları oluşturabilirsiniz.</p>
                    </div>
                )}

                {messages.map((message) => (
                    <div key={message.id} className={`message ${message.role}`}>
                        <div className="message-avatar">
                            {message.role === 'assistant' ? 'AI' : 'Siz'}
                        </div>
                        <div
                            className="message-content"
                            dangerouslySetInnerHTML={renderMessageContent(message.content)}
                        />
                        <div className="message-time">
                            {message.timestamp.toLocaleTimeString()}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="message assistant loading-message">
                        <div className="message-avatar">AI</div>
                        <div className="loading">Düşünüyor</div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
                <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => {
                        setInputMessage(e.target.value);
                        autoResizeTextarea();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Veritabanı hakkında bir soru sorun..."
                    disabled={isLoading}
                    rows={1}
                />

                <div className="buttons-container">
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !inputMessage.trim()}
                        className="send-button"
                        title="Mesaj Gönder"
                    >
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    </button>

                    {isLoading && (
                        <button
                            onClick={handleStopResponse}
                            className="stop-button"
                            title="İşlemi Durdur"
                        >
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 6h12v12H6z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatBot;

