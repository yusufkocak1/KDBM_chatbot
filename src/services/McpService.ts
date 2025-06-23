import {McpMessage} from "../types/mcp";

class McpService {
    private ws: WebSocket | null = null;
    private messageHandlers: Map<string, (data: any) => void> = new Map();
    private isConnecting: boolean = false;
    private connectionPromise: Promise<void> | null = null;

    connect(): Promise<void> {
        // Zaten bağlı ise mevcut WebSocket bağlantısını döndür
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('MCP sunucusuna zaten bağlı, mevcut bağlantı kullanılıyor.');
            return Promise.resolve();
        }

        // Bağlantı kurulma aşamasında ise bekleyen promise'i döndür
        if (this.isConnecting && this.connectionPromise) {
            console.log('MCP sunucusuna bağlanma işlemi zaten devam ediyor, bekliyor...');
            return this.connectionPromise;
        }

        // Yeni bağlantı oluştur
        this.isConnecting = true;
        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                console.log('MCP sunucusuna bağlanmaya çalışılıyor...');
                this.ws = new WebSocket('ws://localhost:8080/mcp');

                this.ws.onopen = () => {
                    console.log('MCP bağlantısı başarıyla kuruldu');
                    this.isConnecting = false;
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                };

                this.ws.onerror = (error) => {
                    console.error('MCP bağlantı hatası:', error);
                    reject(new Error('MCP sunucusuna bağlanılamadı. Sunucunun çalıştığından emin olun.'));
                };

                this.ws.onclose = (event) => {
                    console.warn(`MCP bağlantısı kapandı, kod: ${event.code}, sebep: ${event.reason}`);
                    if (!event.wasClean) {
                        console.error('Bağlantı beklenmedik şekilde kapandı');
                    }
                };

                // 5 saniye içinde bağlantı kurulamazsa zaman aşımı
                setTimeout(() => {
                    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                        console.error('MCP bağlantısı zaman aşımına uğradı');
                        this.ws.close();
                        reject(new Error('MCP sunucusuna bağlantı zaman aşımına uğradı. Sunucu çalışıyor mu?'));
                    }
                }, 5000);

            } catch (error) {
                console.error('MCP bağlantısı oluşturulurken hata:', error);
                reject(error);
            }
        });

        return this.connectionPromise;
    }

    sendMessage(message: McpMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws) {
                reject(new Error('WebSocket bağlantısı yok'));
                return;
            }

            const messageId = Math.random().toString(36).substr(2, 9);
            message.id = messageId;
            console.log(`Mesaj gönderiliyor, ID: ${messageId}`, message);

            this.messageHandlers.set(messageId, (response) => {
                console.log(`Handler çağrıldı, ID: ${messageId}, yanıt:`, response);

                if (response.error) {
                    reject(new Error(response.error.message || 'Bilinmeyen hata'));
                    return;
                }

                // Yanıt veri yapısını analiz et ve mevcut olan ilk değeri kullan
                if (response.params && response.params.tools) {
                    // tools/list/response özel durumu
                    console.log("tools/list/response yanıtı algılandı");
                    resolve(response.params.tools);
                } else if (response.result !== undefined) {
                    resolve(response.result);
                } else if (response.data !== undefined) {
                    resolve(response.data);
                } else if (response.tools !== undefined) {
                    resolve(response.tools);
                } else if (response.body !== undefined) {
                    resolve(response.body);
                } else if (response.payload !== undefined) {
                    resolve(response.payload);
                } else if (Array.isArray(response)) {
                    // Yanıt doğrudan bir dizi olabilir
                    resolve(response);
                } else {
                    // Sunucunun yanıt formatı özel olabilir, bu durumda tüm yanıtı döndür
                    console.log('Standart yanıt formatı bulunamadı, tüm yanıt döndürülüyor:', response);
                    resolve(response);
                }
            });

            this.ws.send(JSON.stringify(message));
        });
    }

    private handleMessage(message: any) {
        if (message.id && this.messageHandlers.has(message.id)) {
            const handler = this.messageHandlers.get(message.id)!;

            // 'error' metodu varsa (MCP'nin hata mesajları için)
            if (message.method === 'error') {
                console.error('MCP hata mesajı:', message);
                // Hata mesajı oluştur ve kullanıcıya göster
                const errorMessage = message.params?.message || message.params?.error || "Bilinmeyen bir MCP hatası";
                handler({ error: { message: errorMessage } });
                this.messageHandlers.delete(message.id);
                return;
            }

            handler(message);
            this.messageHandlers.delete(message.id);
        } else if (message.method === 'error') {
            // ID'siz gelen hata mesajları için (genel broadcast hatalar)
            console.error('Genel MCP hata mesajı:', message);
            // Bu durumda özel bir işlem yapılabilir (global hata işleyici çağrılabilir)
        }
    }

    async getAvailableTools(): Promise<any[]> {
        try {
            const message: McpMessage = {
                jsonrpc: "2.0",
                method: "tools/list",
                params: {}
            };

            const tools = await this.sendMessage(message);
            console.log("Araçlar başarıyla alındı:", tools);
            return tools;
        } catch (error) {
            console.error("Araçlar alınamadı:", error);
            return [];
        }
    }

    async callTool(toolName: string, args: any): Promise<any> {
        if (!this.ws) {
            throw new Error('WebSocket bağlantısı yok');
        }

        try {
            const message: McpMessage = {
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                    toolName,
                    args
                }
            };

            return await this.sendMessage(message);
        } catch (error) {
            console.error(`${toolName} aracı çağrılırken hata oluştu:`, error);
            throw error;
        }
    }
}

export const mcpService = new McpService();