/* ==========================================================================
   YENİ DOSYA: src/features/Handlers/InteractionHandler.ts
   
   SORUMLULUK: Dosya veya kod seçimi gibi bağlam (context) içeren
   kullanıcı etkileşimlerini yönetir. Niyet analizi yapar (cevap ver vs.
   değiştir), API çağrılarını tetikler ve sonucu (cevap veya diff)
   webview'e gönderir.
   ========================================================================== */

import * as vscode from 'vscode';
import { ApiServiceManager } from '../../services/ApiServiceManager';
import { ConversationManager } from '../ConversationManager';
import { createModificationPrompt, createFileInteractionAnalysisPrompt, createSelectionInteractionAnalysisPrompt } from '../../core/promptBuilder';
import { cleanLLMCodeBlock, cleanLLMJsonBlock } from '../../core/utils';
import { DiffData } from '../../types/index';

type InteractionContext = 
    | { type: 'file'; files: Array<{ uri: vscode.Uri; content: string; fileName: string; }> }
    | { type: 'selection'; code: string; uri: vscode.Uri; selection: vscode.Selection };

export class InteractionHandler {
    constructor(
        private conversationManager: ConversationManager,
        private apiManager: ApiServiceManager,
        private webview: vscode.Webview
    ) {}

    public async handle(instruction: string, context: InteractionContext) {
        this.conversationManager.addMessage('user', instruction);
        let analysisResponseRaw = '';

        try {
            // 1. Niyet Analizi Prompt'unu oluştur ve API'yi çağır
            const analysisPrompt = this.createAnalysisPrompt(instruction, context);
            analysisResponseRaw = await this.apiManager.generateContent(analysisPrompt);

            const cleanedJsonString = cleanLLMJsonBlock(analysisResponseRaw);
            const analysisResult = JSON.parse(cleanedJsonString);

            const { intent, fileName, explanation } = analysisResult;

            if (!intent || !explanation) {
                throw new Error('Modelden beklenen formatta JSON yanıtı alınamadı: "intent" veya "explanation" eksik.');
            }

            // 2. Niyete göre işlemi gerçekleştir
            if (intent === 'answer') {
                this.handleAnswer(explanation);
            } else if (intent === 'modify') {
                await this.handleModification(instruction, explanation, context, fileName);
            }

        } catch (error: any) {
            console.error("Interaction Handler Error:", error);
            this.conversationManager.removeLastMessage();

            // Hata durumunda, eğer model JSON yerine düz metin döndürdüyse bunu göster.
            if (error.message.includes('JSON') && analysisResponseRaw) {
                console.log("JSON parsing failed. Falling back to direct answer.");
                this.handleAnswer(analysisResponseRaw);
            } else {
                const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
                this.webview.postMessage({ type: 'addResponse', payload: `**Hata:** ${errorMessage}` });
            }
        }
    }

    private createAnalysisPrompt(instruction: string, context: InteractionContext): string {
        if (context.type === 'file') {
            return createFileInteractionAnalysisPrompt(context.files, instruction);
        } else { // selection
            return createSelectionInteractionAnalysisPrompt(context.code, instruction);
        }
    }
    
    private handleAnswer(explanation: string) {
        this.conversationManager.addMessage('assistant', explanation);
        this.webview.postMessage({ type: 'addResponse', payload: explanation });
    }

    private async handleModification(instruction: string, explanation: string, context: InteractionContext, targetFileName?: string) {
        const modificationContext = this.getModificationContext(context, targetFileName);
        if (!modificationContext) {
            const errorMsg = `**Hata:** Model, mevcut olmayan bir bağlamı (${targetFileName || 'belirtilmemiş'}) değiştirmeye çalıştı.`;
            this.handleAnswer(errorMsg);
            return;
        }

        // Kodu değiştirmek için yeni prompt oluştur ve API'yi çağır
        const modificationPrompt = createModificationPrompt(instruction, modificationContext.code);
        const modifiedCodeResponse = await this.apiManager.generateContent(modificationPrompt);
        const cleanedCode = cleanLLMCodeBlock(modifiedCodeResponse);

        // Hem açıklamayı hem de fark görünümünü (diff) webview'e gönder
        this.conversationManager.addMessage('assistant', explanation);
        this.webview.postMessage({ type: 'addResponse', payload: explanation });

        const diffData = this.createDiffData(cleanedCode, modificationContext);
        this.webview.postMessage({ type: 'showDiff', payload: diffData });
    }

    private getModificationContext(context: InteractionContext, targetFileName?: string): { code: string, uri: vscode.Uri, selection?: vscode.Selection } | null {
        if (context.type === 'selection') {
            return { code: context.code, uri: context.uri, selection: context.selection };
        }
        if (context.type === 'file') {
            const fileToModify = context.files.find(c => c.fileName === targetFileName);
            if (!fileToModify) return null;
            return { code: fileToModify.content, uri: fileToModify.uri };
        }
        return null;
    }

    private createDiffData(modifiedCode: string, modContext: { code: string, uri: vscode.Uri, selection?: vscode.Selection }): DiffData {
        if (modContext.selection) { // Selection context
            return {
                originalCode: modContext.code,
                modifiedCode: modifiedCode,
                context: {
                    type: 'selection',
                    selection: { 
                        uri: modContext.uri.toString(), 
                        range: [modContext.selection.start.line, modContext.selection.start.character, modContext.selection.end.line, modContext.selection.end.character]
                    }
                }
            };
        } else { // File context
            return {
                originalCode: modContext.code,
                modifiedCode: modifiedCode,
                context: {
                    type: 'file',
                    fileUri: modContext.uri.toString()
                }
            };
        }
    }
}