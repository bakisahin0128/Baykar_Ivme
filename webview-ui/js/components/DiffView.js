/* ==========================================================================
   DIFF VIEW BİLEŞENİ
   Kod farkı görünümünü gösterme, gizleme ve onaylama/reddetme
   işlevselliğini yönetir.
   ========================================================================== */

import * as DOM from '../utils/dom.js';
import * as VsCode from '../services/vscode.js';
import { setDiffViewActive } from '../core/state.js';
// DEĞİŞİKLİK: 'addUserMessage' yerine 'addSystemMessage' import edildi.
import { addSystemMessage } from './ChatView.js';

let pendingDiffData = null;

function createSmartDiffHtml(oldText, newText) {
    const diff = Diff.diffWords(oldText, newText);
    let html = '';
    diff.forEach(part => {
        const colorClass = part.added ? 'diff-added' :
                           part.removed ? 'diff-removed' : 'diff-unchanged';
        const value = part.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

        html += `<span class="${colorClass}">${value}</span>`;
    });
    return html;
}

function handleApproveChange() {
    if (pendingDiffData) {
        VsCode.postMessage('approveChange', { diff: pendingDiffData });
        DOM.approveChangeButton.disabled = true;
        DOM.rejectChangeButton.disabled = true;
        DOM.approveChangeButton.textContent = 'Uygulanıyor...';
    }
}

function handleRejectOrCloseChange() {
    pendingDiffData = null;
    hide();
}

// --- Public Fonksiyonlar ---

export function init() {
    DOM.approveChangeButton.addEventListener('click', handleApproveChange);
    DOM.rejectChangeButton.addEventListener('click', handleRejectOrCloseChange);
    DOM.closeDiffButton.addEventListener('click', handleRejectOrCloseChange);
}

export function show(diffData) {
    pendingDiffData = diffData;
    const loadingElement = document.getElementById('ai-loading-placeholder');
    if (loadingElement) {
       loadingElement.remove();
    }
    
    const smartDiffHtml = createSmartDiffHtml(diffData.originalCode, diffData.modifiedCode);
    DOM.unifiedDiffCodeBlock.innerHTML = smartDiffHtml;

    DOM.diffContainer.classList.remove('hidden');
    setDiffViewActive(true);
}

export function hide() {
    DOM.diffContainer.classList.add('hidden');
    DOM.unifiedDiffCodeBlock.innerHTML = '';
    setDiffViewActive(false);
}

export function handleSuccessfulChange() {
    hide();
    // DEĞİŞİKLİK: Hatalı fonksiyon yerine yeni 'addSystemMessage' kullanılıyor.
    addSystemMessage("Değişiklik başarıyla uygulandı!");
    DOM.approveChangeButton.disabled = false;
    DOM.rejectChangeButton.disabled = false;
    DOM.approveChangeButton.textContent = 'Değişikliği Onayla';
}