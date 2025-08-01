/* ==========================================================================
   DOSYA: src/extension.ts (REFAKTÖR EDİLMİŞ)
   
   SORUMLULUK: Eklentinin ana giriş noktası. Servisleri, yöneticileri
   ve sağlayıcıları başlatır, komutları ve arayüz elemanlarını
   VS Code'a kaydeder. Tüm ana mantık, ilgili "Handler" sınıflarına
   devredilmiştir.
   ========================================================================== */

import * as vscode from 'vscode';
import { BaykarAiActionProvider } from './providers/ActionProvider';
import { BaykarAiHoverProvider } from './providers/HoverProvider';
import { ChatViewProvider } from './providers/ChatViewProvider';
import { ApiServiceManager } from './services/ApiServiceManager';
import { CommandHandler } from './features/Handlers/Command'; // YENİ İÇE AKTARMA
import { COMMAND_IDS, UI_MESSAGES, EXTENSION_NAME, EXTENSION_ID, SETTINGS_KEYS } from './core/constants';

export function activate(context: vscode.ExtensionContext) {

    console.log(`"${EXTENSION_NAME}" eklentisi başarıyla aktif edildi!`);

    // --- 1. Servisleri ve Sağlayıcıları Başlat ---
    const apiManager = new ApiServiceManager();
    const chatProvider = new ChatViewProvider(context, apiManager);

    // --- 2. İşleyici (Handler) Sınıflarını Başlat ---
    const commandHandler = new CommandHandler(apiManager, chatProvider);

    // --- 3. Webview'i Kaydet ---
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // --- 4. Komutları Kaydet (Artık daha temiz) ---
    // Her komut, CommandHandler'daki ilgili metoda yönlendiriliyor.
    const checkConnectionCommand = vscode.commands.registerCommand(
        COMMAND_IDS.checkVllmStatus, () => commandHandler.checkConnection()
    );
    const applyFixCommand = vscode.commands.registerCommand(
        COMMAND_IDS.applyFix, (args) => commandHandler.applyFix(args)
    );
    const modifyWithInputCommand = vscode.commands.registerCommand(
        COMMAND_IDS.modifyWithInput, (args) => commandHandler.modifyWithInput(args)
    );
    const sendToChatCommand = vscode.commands.registerCommand(
        COMMAND_IDS.sendToChat, () => commandHandler.sendToChat()
    );
    const showChatCommand = vscode.commands.registerCommand(
        COMMAND_IDS.showChat, () => commandHandler.showChat()
    );

    // --- 5. Arayüz Elementlerini Oluştur ---
    const serviceStatusButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    serviceStatusButton.command = COMMAND_IDS.showChat;
    
    const updateStatusBar = () => {
        const activeService = apiManager.getActiveServiceName();
        serviceStatusButton.text = `$(chip) ${activeService}`;
        serviceStatusButton.tooltip = `Aktif Servis: ${activeService} (${EXTENSION_NAME} panelini aç)`;
    };
    
    updateStatusBar();
    serviceStatusButton.show();
    
    // Ayarlar değiştiğinde durum çubuğunu güncelle.
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(`${EXTENSION_ID}.${SETTINGS_KEYS.activeApiService}`)) {
            updateStatusBar();
        }
    }));

    // --- 6. Tüm Bileşenleri Kaydet ---
    context.subscriptions.push(
        // Komutlar
        checkConnectionCommand,
        applyFixCommand,
        modifyWithInputCommand,
        sendToChatCommand,
        showChatCommand,
        
        // Arayüz Elemanları
        serviceStatusButton,
        
        // Sağlayıcılar
        vscode.languages.registerCodeActionsProvider('python', new BaykarAiActionProvider(), {
            providedCodeActionKinds: BaykarAiActionProvider.providedCodeActionKinds
        }),
        vscode.languages.registerHoverProvider('python', new BaykarAiHoverProvider())
    );
}

export function deactivate() {}