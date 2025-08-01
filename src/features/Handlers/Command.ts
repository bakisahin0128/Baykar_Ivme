/* ==========================================================================
   YENİ DOSYA: src/features/Handlers/CommandHandler.ts
   
   SORUMLULUK: VS Code komut paletinden veya arayüzden tetiklenen
   tüm komutların ana mantığını yönetir. `extension.ts` dosyasını
   temiz tutar.
   ========================================================================== */

import * as vscode from 'vscode';
import { ApiServiceManager } from '../../services/ApiServiceManager';
import { ChatViewProvider } from '../../providers/ChatViewProvider';
import { createFixErrorPrompt, createModificationPrompt } from '../../core/promptBuilder';
import { COMMAND_IDS, UI_MESSAGES, EXTENSION_NAME, EXTENSION_ID, API_SERVICES } from '../../core/constants';
import { cleanLLMCodeBlock } from '../../core/utils';
import { ApplyFixArgs, ModifyWithInputArgs } from '../../types/index';

export class CommandHandler {
    constructor(
        private apiManager: ApiServiceManager,
        private chatProvider: ChatViewProvider // Direkt provider referansı alıyoruz
    ) {}

    /**
     * Aktif API servisinin (vLLM veya Gemini) bağlantı durumunu kontrol eder.
     */
    public async checkConnection() {
        const activeService = this.apiManager.getActiveServiceName();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${activeService} durumu kontrol ediliyor...`,
            cancellable: false
        }, async () => {
            const isConnected = await this.apiManager.checkConnection();
            if (isConnected) {
                vscode.window.showInformationMessage(`${activeService} ile bağlantı başarılı!`);
            } else {
                const errorMsg = activeService === API_SERVICES.gemini
                    ? UI_MESSAGES.geminiConnectionError
                    : UI_MESSAGES.vllmConnectionError;
                vscode.window.showErrorMessage(errorMsg);
            }
        });
    }

    /**
     * Hata düzeltme (Quick Fix) komutunun mantığını çalıştırır.
     */
    public async applyFix(args: ApplyFixArgs) {
        const uri = vscode.Uri.parse(args.uri);
        const document = await vscode.workspace.openTextDocument(uri);
        const prompt = createFixErrorPrompt(args.diagnostic.message, args.diagnostic.range[0] + 1, document.getText());

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: UI_MESSAGES.thinking, cancellable: true }, async () => {
            try {
                const correctedCode = await this.apiManager.generateContent(prompt);
                const cleanedCode = cleanLLMCodeBlock(correctedCode);
                
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
                edit.replace(document.uri, fullRange, cleanedCode);
                await vscode.workspace.applyEdit(edit);
                
                vscode.window.showInformationMessage(UI_MESSAGES.codeFixed);
            } catch (error: any) {
                const errorMsg = this.apiManager.getActiveServiceName() === API_SERVICES.gemini ? UI_MESSAGES.geminiConnectionError : UI_MESSAGES.vllmConnectionError;
                vscode.window.showErrorMessage(`${errorMsg} Lütfen sohbet panelindeki ayarları kontrol edin.`);
            }
        });
    }

    /**
     * Seçili kodu, kullanıcıdan alınan talimata göre değiştirir.
     */
    public async modifyWithInput(args: ModifyWithInputArgs) {
        const uri = vscode.Uri.parse(args.uri);
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
        if (!editor) return;

        const selection = new vscode.Selection(new vscode.Position(args.range[0], args.range[1]), new vscode.Position(args.range[2], args.range[3]));
        const userInstruction = await vscode.window.showInputBox({ prompt: 'Seçili kod ile ne yapmak istersiniz?' });
        if (!userInstruction) return;

        const selectedText = editor.document.getText(selection);
        const prompt = createModificationPrompt(userInstruction, selectedText);

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: UI_MESSAGES.thinking, cancellable: true }, async () => {
            try {
                const modifiedCode = await this.apiManager.generateContent(prompt);
                const cleanedCode = cleanLLMCodeBlock(modifiedCode);
                editor.edit(editBuilder => editBuilder.replace(selection, cleanedCode));
                vscode.window.showInformationMessage(UI_MESSAGES.codeModified);
            } catch (error: any) {
                const errorMsg = this.apiManager.getActiveServiceName() === API_SERVICES.gemini ? UI_MESSAGES.geminiConnectionError : UI_MESSAGES.vllmConnectionError;
                vscode.window.showErrorMessage(`${errorMsg} Lütfen sohbet panelindeki ayarları kontrol edin.`);
            }
        });
    }
        
    /**
     * Aktif editörde seçili olan kodu sohbet paneline bağlam (context) olarak gönderir.
     */
    public async sendToChat() {
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            this.chatProvider.setActiveContext(editor.document.uri, editor.selection, editor.document.getText(editor.selection));
            vscode.commands.executeCommand(`${EXTENSION_ID}.chatView.focus`);
        } else {
            vscode.window.showInformationMessage('Lütfen önce bir kod bloğu seçin.');
        }
    }

    /**
     * Sohbet panelini görünür hale getirir ve odaklanır.
     */
    public showChat() {
        vscode.commands.executeCommand(`${EXTENSION_ID}.chatView.focus`);
    }
}