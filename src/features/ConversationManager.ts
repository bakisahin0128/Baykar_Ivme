/* ==========================================================================
   DOSYA 1: src/features/ConversationManager.ts (GÜNCELLENMİŞ)

   SORUMLULUK: Tüm konuşma verilerini yönetir.
   YENİ GÜNCELLEME: Eklenti ilk yüklendiğinde her zaman temiz bir "Yeni Konuşma"
                    ile başlamasını sağlar, böylece eski sohbetin boyutu ve
                    içeriği yanlışlıkla yüklenmez.
   ========================================================================== */

import * as vscode from 'vscode';
import { Conversation, ChatMessage } from '../types/index';
import { generateUUID } from '../core/utils';
import { EXTENSION_ID, SETTINGS_KEYS } from '../core/constants';

export class ConversationManager {
    private conversations: Conversation[] = [];
    private activeConversationId: string | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.loadConversationsFromState();
        // Eklenti ilk başladığında her zaman yeni bir sohbet oluştur.
        // Bu, eski sohbetin yanlışlıkla aktif olmasını engeller.
        this.createNew();
    }

    public createNew(): Conversation {
        const initialSystemPrompt = `Sen Baykar bünyesinde çalışan, uzman bir yazılım geliştirme asistanısın. Cevaplarını, okunabilirliği artırmak için listeler, kalın metinler ve kod parçacıkları gibi zengin formatlar içeren Markdown formatında oluştur. Kod bloklarını python gibi dil belirterek ver.`;
        const newConv: Conversation = {
            id: generateUUID(),
            timestamp: Date.now(),
            title: "Yeni Konuşma",
            messages: [{ role: 'system', content: initialSystemPrompt }]
        };
        this.conversations.push(newConv);
        this.activeConversationId = newConv.id;
        // Yeni oluşturulan bu konuşmayı kaydetmiyoruz. Sadece kullanıcı mesaj gönderirse kaydedilecek.
        return newConv;
    }

    public getActive(): Conversation | undefined {
        if (!this.activeConversationId) {
            // Eğer bir sebepten aktif ID yoksa, en sonuncusunu bul veya yeni oluştur.
            const lastConversation = this.conversations.sort((a, b) => b.timestamp - a.timestamp)[0];
            if (lastConversation) {
                this.activeConversationId = lastConversation.id;
            } else {
                return this.createNew();
            }
        }
        return this.conversations.find(c => c.id === this.activeConversationId);
    }

    public getActiveConversationSize(): number {
        const activeConv = this.getActive();
        if (!activeConv) {
            return 0;
        }

        const config = vscode.workspace.getConfiguration(EXTENSION_ID);
        const historyLimit = config.get<number>(SETTINGS_KEYS.conversationHistoryLimit, 2);

        // Sistem mesajı hariç ve son kullanıcı mesajı (henüz gönderilmemiş) hariç
        const messagesWithoutSystem = activeConv.messages.filter(m => m.role !== 'system');
        const limitedMessages = messagesWithoutSystem.slice(-(historyLimit * 2));

        return limitedMessages.reduce((total, message) => total + message.content.length, 0);
    }

    public addMessage(role: 'user' | 'assistant', content: string): void {
        const activeConv = this.getActive();
        if (activeConv) {
            // Eğer bu, "Yeni Konuşma"nın ilk kullanıcı mesajı ise, başlığı güncelle.
            if (activeConv.title === "Yeni Konuşma" && role === 'user' && activeConv.messages.length <= 1) {
                 activeConv.title = content.length > 40 ? content.substring(0, 37) + '...' : content;
            }
            activeConv.messages.push({ role, content });
            activeConv.timestamp = Date.now();
            this.save();
        }
    }
    
    public removeLastMessage(): void {
        const activeConv = this.getActive();
        if (activeConv) {
            activeConv.messages.pop();
            // Not: Geçici olduğu için burada save() çağırmıyoruz.
        }
    }

    public getHistorySummary(): { id: string, title: string }[] {
        // "Yeni Konuşma" başlığına sahip ve içinde sadece sistem mesajı olan geçici sohbetleri listeye dahil etme
        return this.conversations
            .filter(c => !(c.title === "Yeni Konuşma" && c.messages.length <= 1))
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(c => ({ id: c.id, title: c.title }));
    }

    public switchConversation(id: string): Conversation | undefined {
        const conversation = this.conversations.find(c => c.id === id);
        if (conversation) {
            this.activeConversationId = id;
        }
        return conversation;
    }

    public deleteConversation(id: string): Conversation | null {
        // Silinecek olanın dışındaki tüm konuşmaları ve geçici olmayanları tut
        this.conversations = this.conversations.filter(c => c.id !== id && !(c.title === "Yeni Konuşma" && c.messages.length <= 1));
        
        if (this.activeConversationId === id) {
            // Aktif olan silindiyse, en son kaydedilmiş sohbete geç
            const lastConversation = this.conversations
                .filter(c => !(c.title === "Yeni Konuşma" && c.messages.length <= 1))
                .sort((a, b) => b.timestamp - a.timestamp)[0];
            
            if (lastConversation) {
                this.activeConversationId = lastConversation.id;
                return lastConversation;
            } else {
                // Hiç sohbet kalmadıysa, yeni bir tane oluştur ama bunu aktif yapma
                return this.createNew();
            }
        }
        this.save();
        return this.getActive() ?? null;
    }

    private async save() {
        // Kaydedilirken, geçici, boş "Yeni Konuşma"ları kaydetmediğimizden emin olalım.
        const conversationsToSave = this.conversations
            .filter(c => !(c.title === "Yeni Konuşma" && c.messages.length <= 1))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50); // En son 50 konuşmayı sakla
        await this.context.workspaceState.update('baykar.conversations', conversationsToSave);
    }

    // `load` fonksiyonunu `loadConversationsFromState` olarak yeniden adlandırdık.
    private loadConversationsFromState() {
        const savedConversations = this.context.workspaceState.get<Conversation[]>('baykar.conversations');
        if (savedConversations && savedConversations.length > 0) {
            this.conversations = savedConversations;
        } else {
            this.conversations = [];
        }
    }
}