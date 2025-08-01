/* ==========================================================================
   BİLEŞEN BAŞLATICISI (Component Initializer)
   ========================================================================== */

import * as ChatView from './ChatView.js';
import * as DiffView from './DiffView.js';
import * as FileTags from './FileTags.js';
import * as Header from './Header.js';
import * as HistoryPanel from './HistoryPanel.js';
import * as InputArea from './InputArea.js';
import * as SettingsModal from './SettingsModal.js';

export function initComponents() {
    ChatView.init();
    DiffView.init();
    FileTags.init();
    Header.init();
    HistoryPanel.init();
    InputArea.init();
    SettingsModal.init();
}