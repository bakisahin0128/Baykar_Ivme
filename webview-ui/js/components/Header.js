/* ==========================================================================
   HEADER BİLEŞENİ
   Üst bar ve ikon butonlarının olaylarını yönetir.
   ========================================================================== */

import * as DOM from '../utils/dom.js';
import * as VsCode from '../services/vscode.js';
import { getState, toggleAnimationEffect } from '../core/state.js';

function updateEffectToggleVisual() {
    if (!DOM.effectToggleSwitch) return;
    DOM.effectToggleSwitch.checked = getState().currentAnimationEffect === 'diffusion';
}

// --- Public Fonksiyonlar ---

export function init() {
    updateEffectToggleVisual();

    DOM.newChatButton.addEventListener('click', () => {
        if (getState().isUiBlocked) return;
        VsCode.postMessage('newChat');
    });
    
    // YENİ EKLENEN BLOK
    DOM.feedbackButton.addEventListener('click', () => {
        VsCode.postMessage('showFeedbackMessage');
    });

    DOM.effectToggleSwitch.addEventListener('change', toggleAnimationEffect);
}