/* ==========================================================================
   MESAJ YÖNLENDİRİCİ (MESSAGE ROUTER)
   VS Code eklentisinden gelen tüm mesajları dinler ve ilgili
   bileşenin fonksiyonunu tetikler.
   ========================================================================== */

import { onMessage } from '../services/vscode.js';
import * as ChatView from '../components/ChatView.js';
import * as DiffView from '../components/DiffView.js';
import * as FileTags from '../components/FileTags.js';
import * as HistoryPanel from '../components/HistoryPanel.js';
import * as InputArea from '../components/InputArea.js';
import * as SettingsModal from '../components/SettingsModal.js';
import { setContextSize, resetChatState } from './state.js';

export function initMessageListener() {
    onMessage(message => {
        const data = message.payload ?? message.value;
        
        switch (message.type) {
            case 'addResponse':
                ChatView.showAiResponse(data);
                break;
            
            case 'updateContextSize':
                setContextSize(data.conversationSize, data.filesSize);
                InputArea.recalculateTotalAndUpdateUI();
                break;
            
            case 'showDiff':
                DiffView.show(data);
                break;

            case 'changeApproved':
                DiffView.handleSuccessfulChange();
                break;

            case 'fileContextSet': 
                FileTags.display(message.fileNames); 
                break;

            case 'clearContext':
            case 'clearFileContext':
                FileTags.clear(); 
                break;

            case 'loadConfig':
                SettingsModal.loadConfig(data);
                break;

            case 'loadHistory':
                HistoryPanel.populate(data);
                break;

            case 'clearChat':
                ChatView.clear();
                resetChatState();
                InputArea.recalculateTotalAndUpdateUI();
                InputArea.autoResize();
                break;

            case 'loadConversation':
                ChatView.load(data);
                break;

            case 'contextSet': 
                 InputArea.setPlaceholder(data);
                 InputArea.focus();
                 break;
        }
    });
}