(function () {
  'use strict';
  // ============================================================
  // TOPIK 30 Ngay - shared rendering engine (t30)
  // Dung chung cho toan bo 30 ngay, chi load 1 lan duy nhat.
  // Xay dung tu phien ban day30.html (ban hoan thien nhat, da bao gom
  // highlightExampleText, data-en-text/data-vi-text, xu ly note khong
  // co body_ko...). Da kiem tra tuong thich nguoc voi du lieu cac ngay
  // truoc do (cac truong moi la optional, ngay cu khong co van chay binh
  // thuong).
  // Moi lan chuyen ngay, t30.mount() se reset state va render lai
  // vao container duoc truyen vao - khong con iframe, khong xung dot
  // ten ham/bien vi tat ca deu nam trong closure nay.
  // ============================================================

  const state = {
    vocabData: [],
    dict: {},
    translationLanguage: localStorage.getItem('topikTranslationLanguage') || 'en',
    reviewChecked: false,
    selectedMatchingCards: [],
    mindmapRedrawTimer: null,
    container: null
  };

function speakText(text) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      } else {
        alert("Thiết bị không hỗ trợ phát âm trực tiếp.");
      }
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.getElementById(tabId).classList.remove('hidden');
      const tabs = ['check-tab', 'detail-tab', 'confuse-tab', 'review-tab'];
      tabs.forEach(t => {
        const btn = document.getElementById('btn-' + t);
        if (t === tabId) {
          btn.className = "w-full py-2.5 text-sm font-medium leading-5 rounded-lg transition-all duration-200 bg-white text-teal-700 shadow-xs font-semibold border border-slate-200/40";
        } else {
          btn.className = "w-full py-2.5 text-sm font-medium leading-5 rounded-lg transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200/40";
        }
      });
      scheduleMindmapRedraw(180);
    }

    function toggleSingleRedSheet(el, evt) {
      if (evt) evt.stopPropagation();
      el.classList.toggle('red-sheet-hidden');
    }

    function toggleVietnameseInTab(tabId) {
      const tab = document.getElementById(tabId);
      if (!tab) return;
      const targets = Array.from(tab.querySelectorAll('.hideable-meaning'));
      if (!targets.length) return;

      const shouldShow = targets.every(el => el.classList.contains('red-sheet-hidden'));
      targets.forEach(el => {
        el.classList.toggle('red-sheet-hidden', !shouldShow);
      });
    }




        function normalizeTranslationKey(text) {
      return String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function translateToVietnamese(text) {
      const key = normalizeTranslationKey(text);
      return state.dict[key] || text;
    }

    function prepareTranslationNode(el) {
      if (!el || !el.textContent) return;
      if (!el.dataset.enText) {
        el.dataset.enText = normalizeTranslationKey(el.textContent);
      }
      if (!el.dataset.viText) {
        el.dataset.viText = translateToVietnamese(el.dataset.enText);
      }
    }

    function applyTranslationLanguage() {
      // BUG CŨ: "document.documentElement.dataset.state.translationLanguage = ..."
      // -> dataset.state là undefined (không có attribute data-state trên <html>),
      // gán property lên undefined làm throw TypeError ngay dòng này, khiến toàn bộ
      // phần còn lại của hàm (đổi text theo ngôn ngữ, đổi label nút) không chạy,
      // và exception này còn lan lên tới mount() ở mọi lần load ngày.
      document.documentElement.dataset.translationLanguage = state.translationLanguage;
      document.querySelectorAll('.hideable-meaning, [data-translatable="true"]').forEach(el => {
        prepareTranslationNode(el);
        el.textContent = state.translationLanguage === 'vi' ? el.dataset.viText : el.dataset.enText;
      });

      const label = document.getElementById('translation-language-label');
      if (label) {
        label.textContent = state.translationLanguage === 'vi'
          ? 'Bản dịch: Tiếng Việt'
          : 'Bản dịch: English';
      }
      updateReviewLanguageMode();
      scheduleMindmapRedraw(180);
    }

    function toggleTranslationLanguage() {
      state.translationLanguage = state.translationLanguage === 'en' ? 'vi' : 'en';
      localStorage.setItem('topikTranslationLanguage', state.translationLanguage);
      applyTranslationLanguage();
    }




    function isVietnameseMode() {
      return state.translationLanguage === 'vi';
    }

    function setShowAnswersEnabled(enabled) {
      const btn = document.getElementById('show-review-answers-btn');
      if (!btn) return;
      btn.disabled = !enabled;
      btn.classList.toggle('review-action-disabled', !enabled);
      btn.title = enabled ? 'Hiện đáp án' : 'Hãy bấm “Kiểm tra đáp án” trước';
    }

    function setReviewChoiceTranslationsVisible(visible) {
      document.querySelectorAll('.review-choice-translation').forEach(el => {
        el.classList.toggle('hidden', !visible);
      });
    }

    function updateReviewLanguageMode() {
      document.querySelectorAll('[data-review-input]').forEach(input => {
        const no = input.dataset.reviewInput;
        const direction = input.dataset.direction || (Number(no) <= 5 ? 'ko-to-meaning' : 'meaning-to-ko');
        const answerEn = input.dataset.answerEn || input.dataset.answer || '';
        const answerVi = input.dataset.answerVi || answerEn;

        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label && label.dataset.promptEn) {
          const prompt = isVietnameseMode()
            ? (label.dataset.promptVi || label.dataset.promptEn)
            : label.dataset.promptEn;
          label.textContent = `${no}. ${prompt} →`;
        }

        if (isVietnameseMode()) {
          if (direction === 'meaning-to-ko') {
            input.dataset.answer = answerVi || answerEn;
            input.placeholder = 'Nhập tiếng Hàn';
          } else {
            input.dataset.answer = answerVi;
            input.placeholder = 'Nhập tiếng Việt';
          }
        } else {
          input.dataset.answer = answerEn;
          input.placeholder = direction === 'meaning-to-ko'
            ? 'Nhập tiếng Hàn'
            : 'Nhập nghĩa tiếng Anh';
        }
      });

      if (document.querySelector('[data-review-input]')) {
        const reviewHeader = document.querySelector('#review-tab section h2');
        if (reviewHeader) {
          reviewHeader.textContent = isVietnameseMode()
            ? '한국어는 베트남어로, 베트남어는 한국어로 써 보세요.'
            : '한국어는 영어로, 영어는 한국어로 써 보세요.';
        }

        const reviewInstruction = document.getElementById('review-translation-instruction');
        if (reviewInstruction) {
          reviewInstruction.textContent = isVietnameseMode()
            ? 'Hãy viết từ tiếng Hàn sang tiếng Việt, và từ tiếng Việt sang tiếng Hàn.'
            : 'Write Korean in English, and English in Korean.';
          reviewInstruction.dataset.enText = 'Write Korean in English, and English in Korean.';
          reviewInstruction.dataset.viText = 'Hãy viết từ tiếng Hàn sang tiếng Việt, và từ tiếng Việt sang tiếng Hàn.';
        }
      }

      const matchingTitle = document.getElementById('review-matching-title');
      if (matchingTitle) {
        matchingTitle.textContent = isVietnameseMode()
          ? '한국어와 베트남어 뜻을 알맞게 연결해 보세요.'
          : '한국어와 영어를 알맞게 연결해 보세요.';
      }

      if (!state.reviewChecked) {
        setReviewChoiceTranslationsVisible(false);
      }
      setShowAnswersEnabled(state.reviewChecked);
    }


    function normalizeReviewAnswer(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[，、]/g, ',')
        .replace(/[.,;:!?()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ');
    }

    function getMainAnswer(answerString) {
      return String(answerString || '').split('|')[0].trim();
    }

    function isReviewAnswerCorrect(userValue, answerString) {
      const normalizedUser = normalizeReviewAnswer(userValue);
      if (!normalizedUser) return false;
      return String(answerString || '')
        .split('|')
        .map(normalizeReviewAnswer)
        .some(answer => answer && normalizedUser === answer);
    }

    function setReviewFeedback(no, message, status) {
      const feedback = document.querySelector(`[data-review-feedback="${no}"]`);
      if (!feedback) return;
      feedback.textContent = message || '';
      feedback.className = `review-feedback ${status || 'muted'}`;
    }

    function clearChoiceState(box) {
      box.querySelectorAll('.review-radio-label').forEach(label => {
        label.classList.remove('is-selected', 'is-correct', 'is-wrong');
      });
      box.querySelectorAll('.review-choice').forEach(btn => {
        btn.classList.remove('is-selected', 'is-correct', 'is-wrong');
      });
    }

    function selectReviewRadio(no, value) {
      const box = document.querySelector(`[data-review-choice-question="${no}"]`);
      if (!box) return;
      box.dataset.selected = value;
      clearChoiceState(box);
      const selectedLabel = box.querySelector(`[data-choice-label="${no}-${value}"]`);
      if (selectedLabel) selectedLabel.classList.add('is-selected');
      setReviewFeedback(no, 'Đã chọn. Bấm “Kiểm tra đáp án” để xem kết quả.', 'muted');
    }

    function selectReviewChoice(no, value, button) {
      const box = document.querySelector(`[data-review-choice-question="${no}"]`);
      if (!box) return;
      const radio = box.querySelector(`input[name="review-choice-${no}"][value="${value}"]`);
      if (radio) {
        radio.checked = true;
        selectReviewRadio(no, value);
        return;
      }
      box.dataset.selected = value;
      clearChoiceState(box);
      if (button) button.classList.add('is-selected');
      setReviewFeedback(no, 'Đã chọn. Bấm “Kiểm tra đáp án” để xem kết quả.', 'muted');
    }



    function selectMatchingCard(card) {
      if (!card || card.classList.contains('is-matched')) return;
      const board = card.closest('[data-matching-board]');
      if (!board) return;

      if (card.classList.contains('is-selected')) {
        card.classList.remove('is-selected');
        state.selectedMatchingCards = state.selectedMatchingCards.filter(c => c !== card);
        return;
      }

      const side = card.dataset.matchSide;
      if (state.selectedMatchingCards.some(c => c.dataset.matchSide === side)) return;

      card.classList.add('is-selected');
      state.selectedMatchingCards.push(card);

      if (state.selectedMatchingCards.length === 2) {
        const [first, second] = state.selectedMatchingCards;
        const isCorrect = first.dataset.matchId === second.dataset.matchId;
        if (isCorrect) {
          first.classList.remove('is-selected');
          second.classList.remove('is-selected');
          first.classList.add('is-matched', 'is-correct');
          second.classList.add('is-matched', 'is-correct');
          state.selectedMatchingCards = [];
        } else {
          first.classList.add('is-wrong');
          second.classList.add('is-wrong');
          setTimeout(() => {
            first.classList.remove('is-selected', 'is-wrong');
            second.classList.remove('is-selected', 'is-wrong');
            state.selectedMatchingCards = [];
          }, 650);
        }
      }
    }

    function checkMatchingAnswers() {
      let total = 0;
      let correct = 0;
      document.querySelectorAll('[data-matching-board]').forEach(board => {
        const koCards = board.querySelectorAll('[data-match-side="ko"]');
        total += koCards.length;
        koCards.forEach(card => {
          if (card.classList.contains('is-matched')) correct += 1;
        });
        const fb = board.parentElement.querySelector('[data-review-feedback^="matching-"]');
        if (fb) {
          fb.textContent = `${correct}/${total} cặp đúng`;
          fb.className = `review-feedback ${correct === total ? 'ok' : 'muted'}`;
        }
      });
      return { total, correct };
    }

    function showMatchingAnswers() {
      document.querySelectorAll('[data-matching-board]').forEach(board => {
        board.querySelectorAll('.matching-card').forEach(card => {
          card.classList.remove('is-selected', 'is-wrong');
          card.classList.add('is-matched', 'is-correct');
        });
        const fb = board.parentElement.querySelector('[data-review-feedback^="matching-"]');
        if (fb) {
          const total = board.querySelectorAll('[data-match-side="ko"]').length;
          fb.textContent = `Đã hiện đáp án: ${total}/${total}`;
          fb.className = 'review-feedback ok';
        }
      });
    }

    function resetMatchingAnswers() {
      state.selectedMatchingCards = [];
      document.querySelectorAll('.matching-card').forEach(card => {
        card.classList.remove('is-selected', 'is-matched', 'is-correct', 'is-wrong');
      });
      document.querySelectorAll('[data-review-feedback^="matching-"]').forEach(fb => {
        fb.textContent = '';
        fb.className = 'review-feedback muted';
      });
    }

    function checkReviewAnswers() {
      updateReviewLanguageMode();
      let total = 0;
      let correct = 0;

      document.querySelectorAll('[data-review-input]').forEach(input => {
        total += 1;
        const no = input.dataset.reviewInput;
        const answerString = input.dataset.answer || '';
        input.classList.remove('is-correct', 'is-wrong');
        const ok = isReviewAnswerCorrect(input.value, answerString);
        if (ok) {
          correct += 1;
          input.classList.add('is-correct');
          setReviewFeedback(no, 'Đúng ✓', 'ok');
        } else {
          input.classList.add('is-wrong');
          const mainAnswer = getMainAnswer(answerString);
          setReviewFeedback(no, input.value.trim() ? `Chưa đúng. Đáp án: ${mainAnswer}` : `Chưa nhập. Đáp án: ${mainAnswer}`, 'bad');
        }
      });

      document.querySelectorAll('[data-review-choice-question]').forEach(box => {
        total += 1;
        const no = box.dataset.reviewChoiceQuestion;
        const answer = box.dataset.answer;
        const answerLabel = box.dataset.answerLabel || answer;
        const checked = box.querySelector(`input[name="review-choice-${no}"]:checked`);
        const selected = checked ? checked.value : (box.dataset.selected || '');
        box.dataset.selected = selected;
        clearChoiceState(box);

        box.querySelectorAll('.review-radio-label').forEach(label => {
          const radio = label.querySelector('input[type="radio"]');
          if (!radio) return;
          if (radio.value === answer) label.classList.add('is-correct');
          if (selected && radio.value === selected && selected === answer) label.classList.add('is-selected');
          if (selected && radio.value === selected && selected !== answer) label.classList.add('is-wrong');
        });

        if (selected === answer) {
          correct += 1;
          setReviewFeedback(no, 'Đúng ✓', 'ok');
        } else if (!selected) {
          setReviewFeedback(no, `Chưa chọn. Đáp án: ${answerLabel}`, 'bad');
        } else {
          setReviewFeedback(no, `Chưa đúng. Đáp án: ${answerLabel}`, 'bad');
        }
      });

      const matchResult = checkMatchingAnswers();
      total += matchResult.total;
      correct += matchResult.correct;

      state.reviewChecked = true;
      setShowAnswersEnabled(true);
      setReviewChoiceTranslationsVisible(true);

      const title = document.querySelector('#review-tab h1');
      if (title) title.textContent = `복습해 보세요 — ${correct}/${total}`;
    }

    function showReviewAnswers() {
      if (!state.reviewChecked) {
        setShowAnswersEnabled(false);
        const title = document.querySelector('#review-tab h1');
        if (title) title.textContent = '복습해 보세요 — hãy kiểm tra đáp án trước';
        return;
      }

      updateReviewLanguageMode();

      document.querySelectorAll('[data-review-input]').forEach(input => {
        input.value = getMainAnswer(input.dataset.answer || '');
        input.classList.remove('is-wrong');
        input.classList.add('is-correct');
        setReviewFeedback(input.dataset.reviewInput, 'Đáp án đã được điền ✓', 'ok');
      });
      document.querySelectorAll('[data-review-choice-question]').forEach(box => {
        const no = box.dataset.reviewChoiceQuestion;
        const answer = box.dataset.answer;
        const answerLabel = box.dataset.answerLabel || answer;
        box.dataset.selected = answer;
        const radio = box.querySelector(`input[name="review-choice-${no}"][value="${answer}"]`);
        if (radio) radio.checked = true;
        clearChoiceState(box);
        box.querySelectorAll('.review-radio-label').forEach(label => {
          const input = label.querySelector('input[type="radio"]');
          if (input && input.value === answer) label.classList.add('is-selected', 'is-correct');
        });
        setReviewFeedback(no, `Đáp án: ${answerLabel}`, 'ok');
      });

      showMatchingAnswers();
      setReviewChoiceTranslationsVisible(true);

      const title = document.querySelector('#review-tab h1');
      if (title) title.textContent = '복습해 보세요 — đã hiện đáp án';
    }

    function resetReviewAnswers() {
      document.querySelectorAll('[data-review-input]').forEach(input => {
        input.value = '';
        input.classList.remove('is-correct', 'is-wrong');
        setReviewFeedback(input.dataset.reviewInput, '', 'muted');
      });
      document.querySelectorAll('[data-review-choice-question]').forEach(box => {
        delete box.dataset.selected;
        box.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
        clearChoiceState(box);
        setReviewFeedback(box.dataset.reviewChoiceQuestion, '', 'muted');
      });

      resetMatchingAnswers();
      state.reviewChecked = false;
      setShowAnswersEnabled(false);
      setReviewChoiceTranslationsVisible(false);
      updateReviewLanguageMode();

      const title = document.querySelector('#review-tab h1');
      if (title) title.textContent = '복습해 보세요';
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function escapeJsText(value) {
      return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, ' ');
    }

    function renderViInline(text, className = '') {
      if (!text) return '';
      return `<span class="hideable-meaning ${className}" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(text)}</span>`;
    }

    function renderDetailExtras(item) {
      if (!item.detailBlocks || !item.detailBlocks.length) return '';
      return `<div class="space-y-3 mb-3">${item.detailBlocks.map(renderDetailBlock).join('')}</div>`;
    }

    function renderDetailBlock(block) {
      if (!block || !block.type) return '';

      if (block.type === 'test_note') {
        const tags = (block.tags || []).map(tag => {
          if (tag && typeof tag === 'object') {
            return `<span class="px-2 py-0.5 rounded-full bg-white/70 border border-rose-100 text-rose-700 text-[11px] font-semibold">
              <span class="font-bold">${escapeHtml(tag.ko || '')}</span>
              ${tag.en ? `<span class="hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(tag.en)}</span>` : ''}
            </span>`;
          }
          return `<span class="px-2 py-0.5 rounded-full bg-white/70 border border-rose-100 text-rose-700 text-[11px] font-semibold">${escapeHtml(tag)}</span>`;
        }).join('');
        return `
          <div class="study-extra-card test-note-card">
            <div class="study-extra-title test-note-label">
              <span>${escapeHtml(block.label_ko || '출제 경향')}</span>
              ${block.label_vi ? `<span class="hideable-meaning text-rose-800/80" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.label_vi)}</span>` : ''}
            </div>
            <p class="mt-3 font-semibold text-slate-800 ${block.no_speak ? '' : 'cursor-pointer hover:text-teal-700'}" ${block.no_speak ? '' : `onclick="t30.speakText('${escapeJsText(block.title_ko || '')}')"`}>${escapeHtml(block.title_ko || '')}${block.no_speak ? '' : ' 🔊'}</p>
            ${block.title_vi ? `<p class="mt-1 text-sm text-slate-600 hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.title_vi)}</p>` : ''}
            <p class="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line ${block.no_speak ? '' : 'cursor-pointer hover:text-teal-700'}" ${block.no_speak ? '' : `onclick="t30.speakText('${escapeJsText(block.body_ko || '')}')"`}>${escapeHtml(block.body_ko || '')}${block.no_speak ? '' : ' 🔊'}</p>
            ${block.body_vi ? `<p class="mt-2 text-sm leading-relaxed text-slate-600 hideable-meaning vi-meaning-target whitespace-pre-line" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.body_vi)}</p>` : ''}
            ${tags ? `<div class="mt-3 flex flex-wrap gap-2">${tags}</div>` : ''}
          </div>
        `;
      }


      if (block.type === 'tip_note') {
        const examples = (block.examples || []).map(ex => `
          <div class="combo-box cursor-pointer hover:bg-white transition" onclick="t30.speakText('${escapeJsText(ex.ko || '')}')">
            <p class="font-bold text-slate-800">${escapeHtml(ex.ko || '')} 🔊</p>
            ${ex.en ? `<p class="mt-1 text-sm text-slate-600 hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(ex.en)}</p>` : ''}
          </div>
        `).join('');
        const noteBody = (block.body_ko || block.body_vi || examples) ? `
            <div class="bg-white/70 border border-amber-100 rounded-2xl p-4 space-y-3">
              ${block.body_ko ? `<p class="text-sm text-slate-800 ${block.no_speak ? '' : 'cursor-pointer hover:text-teal-700'}" ${block.no_speak ? '' : `onclick="t30.speakText('${escapeJsText(block.body_ko || '')}')"`}>${escapeHtml(block.body_ko || '')}${block.no_speak ? '' : ' 🔊'}</p>` : ''}
              ${block.body_vi ? `<p class="text-sm text-slate-600 hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.body_vi)}</p>` : ''}
              ${examples ? `<div class="grid grid-cols-1 gap-3 mt-3">${examples}</div>` : ''}
            </div>` : '';
        return `
          <div class="study-extra-card tip-card">
            <div class="flex items-start gap-3 ${noteBody ? 'mb-3' : 'mb-0'}">
              <span class="tip-label">${escapeHtml(block.label || 'Tip')}</span>
              <div>
                <p class="font-bold text-slate-800 ${block.no_speak ? '' : 'cursor-pointer hover:text-teal-700'}" ${block.no_speak ? '' : `onclick="t30.speakText('${escapeJsText(block.question_ko || '')}')"`}>${escapeHtml(block.question_ko || '')}${block.no_speak ? '' : ' 🔊'}</p>
                ${block.question_vi ? `<p class="text-xs text-slate-600 hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.question_vi)}</p>` : ''}
              </div>
            </div>
            ${noteBody}
          </div>
        `;
      }

      if (block.type === 'tip_combo') {
        const rows = (block.items || []).map(pair => `
          <div class="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-b-0">
            <span class="font-bold text-slate-800 cursor-pointer hover:text-teal-700" onclick="t30.speakText('${escapeJsText(pair.ko)}')">${escapeHtml(pair.ko)} 🔊</span>
            <span class="text-xs text-slate-500 text-right hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(pair.vi || '')}</span>
          </div>
        `).join('');
        const tipBody = (block.body_ko || block.body_vi) ? `
          <div class="mt-4 bg-white/70 border border-amber-100 rounded-2xl p-4 space-y-2">
            ${block.body_ko ? `<p class="text-sm leading-relaxed text-slate-700 whitespace-pre-line">${escapeHtml(block.body_ko)}</p>` : ''}
            ${block.body_vi ? `<p class="text-sm leading-relaxed text-slate-500 hideable-meaning vi-meaning-target whitespace-pre-line" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.body_vi)}</p>` : ''}
          </div>` : '';
        const tipExamples = (block.examples || []).length ? `
          <div class="mt-3 grid grid-cols-1 gap-2">
            ${(block.examples || []).map(ex => `
              <div class="combo-box cursor-pointer hover:bg-white transition" onclick="t30.speakText('${escapeJsText(ex.ko || '')}')">
                <p class="font-bold text-slate-800">${escapeHtml(ex.ko || '')} 🔊</p>
                ${ex.en ? `<p class="mt-1 text-sm text-slate-500 hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(ex.en)}</p>` : ''}
              </div>`).join('')}
          </div>` : '';
        return `
          <div class="study-extra-card tip-card">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <span class="tip-label">${escapeHtml(block.label || 'Tip')}</span>
              <div>
                <p class="font-bold text-slate-800 ${block.no_speak ? '' : 'cursor-pointer hover:text-teal-700'}" ${block.no_speak ? '' : `onclick="t30.speakText('${escapeJsText(block.question_ko || '')}')"`}>${escapeHtml(block.question_ko || '')}${block.no_speak ? '' : ' 🔊'}</p>
                ${block.question_vi ? `<p class="text-sm text-slate-500 hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.question_vi)}</p>` : ''}
              </div>
            </div>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
              <div class="combo-box w-full sm:w-48">${rows}</div>
              <div class="text-4xl font-light text-amber-500">+</div>
              <div class="word-pill text-center cursor-pointer hover:scale-[1.02] transition" onclick="t30.speakText('${escapeJsText(block.word || '')}')">
                <span class="text-lg font-black text-slate-900">${escapeHtml(block.word || '')}</span>
                <span class="text-sm text-slate-500 ml-1">🔊</span>
                ${block.word_vi ? `<div class="text-xs text-teal-700 font-semibold mt-1 hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.word_vi)}</div>` : ''}
              </div>
            </div>
            ${tipBody}
            ${tipExamples}
            ${block.note_vi ? `<p class="mt-4 text-xs text-slate-500 italic hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.note_vi)}</p>` : ''}
          </div>
        `;
      }


      if (block.type === 'tip_table') {
        const renderTipExample = (ex) => {
          if (ex && typeof ex === 'object') {
            return `
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-0.5">
                <span class="font-semibold text-slate-800 cursor-pointer hover:text-teal-700" onclick="t30.speakText('${escapeJsText(ex.ko || '')}')">${escapeHtml(ex.ko || '')} 🔊</span>
                <span class="hideable-meaning justify-start text-slate-600" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(ex.en || '')}</span>
              </div>
            `;
          }
          return `<div class="hideable-meaning justify-start" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(ex || '')}</div>`;
        };

        const rows = (block.rows || []).map(row => `
          <tr class="border-t border-amber-100 align-top">
            <td class="py-3 pr-3 font-bold text-slate-800 cursor-pointer hover:text-teal-700" onclick="t30.speakText('${escapeJsText(row.ko || '')}')">
              ${escapeHtml(row.ko || '')} 🔊
              <br>
              <span class="text-xs font-normal text-rose-500 hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(row.en || '')}</span>
            </td>
            <td class="py-3 pl-3 text-sm text-slate-600">
              ${(row.examples || []).map(renderTipExample).join('')}
            </td>
          </tr>
        `).join('');
        return `
          <div class="study-extra-card tip-card">
            <div class="flex items-center gap-3 mb-3">
              <span class="tip-label">${escapeHtml(block.label || 'Tip')}</span>
              <div>
                <p class="font-bold text-slate-800 ${block.no_speak ? '' : 'cursor-pointer hover:text-teal-700'}" ${block.no_speak ? '' : `onclick="t30.speakText('${escapeJsText(block.question_ko || '')}')"`}>${escapeHtml(block.question_ko || '')}${block.no_speak ? '' : ' 🔊'}</p>
                ${block.question_vi ? `<p class="text-xs text-slate-600 hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.question_vi)}</p>` : ''}
              </div>
            </div>
            <div class="overflow-x-auto bg-white/80 border border-amber-100 rounded-2xl p-3">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="text-slate-500">
                    <th class="py-2 pr-3 w-1/3">${escapeHtml((block.columns || ['단어','예'])[0])}</th>
                    <th class="py-2 pl-3">${escapeHtml((block.columns || ['단어','예'])[1])}</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `;
      }

      if (block.type === 'mindmap') {
        // Layout cũ dùng 5 vị trí cố định (top/upper/middle/lower/bottom) map
        // cứng vào 4 hàng lưới, nên khi chỉ có 4 nhánh (top+bottom) thì 2 hàng
        // giữa luôn bỏ trống -> mindmap bị "quá bự" so với nội dung thực tế.
        // Giờ chia đơn giản: nhánh chẵn (0,2,4..) bên trái, lẻ (1,3,5..) bên
        // phải, xếp từ trên xuống liền nhau; số hàng lưới = số nhánh nhiều
        // nhất ở 1 bên, không dư hàng trống nào. Thứ tự trái/phải theo cách
        // này giống hệt layout cũ (positionsByCount trước đây cũng luân
        // phiên trái-phải-trái-phải), nên không đổi cách nhóm từ hiển thị.
        const layoutOrders = {
          '사회': [0, 1, 5, 2, 4, 3],
          '생활': [1, 2, 0, 3, 4, 5],
          '환경': [0, 1, 3, 2]
        };
        const order = layoutOrders[block.center_ko];
        const sourceNodes = order
          ? order.map(index => (block.nodes || [])[index]).filter(Boolean)
          : (block.nodes || []);
        const displayTitleKo = '관련어';

        const leftNodes = [];
        const rightNodes = [];
        sourceNodes.forEach((node, i) => (i % 2 === 0 ? leftNodes : rightNodes).push(node));
        const rowCount = Math.max(leftNodes.length, rightNodes.length, 1);

        const renderNode = (node, rowIndex, column) => `
          <div class="mind-node cursor-pointer hover:border-teal-300 hover:bg-teal-50/40 transition" data-mind-node style="grid-column:${column};grid-row:${rowIndex + 1};" onclick="t30.speakText('${escapeJsText(node.ko)}')">
            <div class="font-bold text-slate-800 text-[1.05rem]">${escapeHtml(node.ko)} 🔊</div>
            <div class="text-xs text-rose-500 font-medium mt-2 hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(node.vi || '')}</div>
          </div>
        `;

        const nodeHtmlList = [
          ...leftNodes.map((node, i) => renderNode(node, i, 1)),
          ...rightNodes.map((node, i) => renderNode(node, i, 3)),
        ].join('');

        return `
          <div class="study-extra-card mindmap-card">
            <div class="flex items-center justify-between gap-3 mb-4">
              <div class="study-extra-title bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span>${escapeHtml(displayTitleKo)}</span>
              </div>
              ${block.title_vi ? `<span class="text-xs text-slate-500 hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.title_vi)}</span>` : ''}
            </div>
            <div class="mindmap-board" data-mindmap-board style="grid-template-rows: repeat(${rowCount}, minmax(76px, auto));">
              <svg class="mindmap-connector-svg" aria-hidden="true"></svg>
              ${nodeHtmlList}
              <div class="mindmap-center cursor-pointer hover:bg-teal-50/60 transition" data-mindmap-center style="grid-row: 1 / span ${rowCount};" onclick="t30.speakText('${escapeJsText(block.center_ko || '')}')">
                <div class="text-2xl font-black text-slate-900">${escapeHtml(block.center_ko || '')}</div>
                <div class="text-sm text-rose-500 font-bold mt-2 hideable-meaning" onclick="t30.toggleSingleRedSheet(this, event)">${escapeHtml(block.center_vi || '')}</div>
              </div>
            </div>
          </div>
        `;
      }

      return '';
    }



    function drawMindmapConnectors() {
      document.querySelectorAll('[data-mindmap-board]').forEach(board => {
        const svg = board.querySelector('.mindmap-connector-svg');
        const center = board.querySelector('[data-mindmap-center]');
        const nodes = Array.from(board.querySelectorAll('[data-mind-node]'));

        if (!svg || !center || !nodes.length) return;

        const boardRect = board.getBoundingClientRect();
        const centerRect = center.getBoundingClientRect();
        const width = Math.max(1, boardRect.width);
        const height = Math.max(1, boardRect.height);

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.innerHTML = '';

        const centerMidY = centerRect.top - boardRect.top + centerRect.height / 2;
        const centerLeft = centerRect.left - boardRect.left;
        const centerRight = centerRect.right - boardRect.left;
        const centerX = centerRect.left - boardRect.left + centerRect.width / 2;

        nodes.forEach(node => {
          const nodeRect = node.getBoundingClientRect();
          const nodeMidY = nodeRect.top - boardRect.top + nodeRect.height / 2;
          const nodeMidX = nodeRect.left - boardRect.left + nodeRect.width / 2;
          const isLeft = nodeMidX < centerX;

          const startX = isLeft ? (nodeRect.right - boardRect.left) : (nodeRect.left - boardRect.left);
          const startY = nodeMidY;
          const endX = isLeft ? centerLeft : centerRight;
          const endY = centerMidY;

          const bendX = isLeft
            ? Math.min(startX + Math.max(28, (endX - startX) * 0.48), endX - 18)
            : Math.max(startX - Math.max(28, (startX - endX) * 0.48), endX + 18);

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`);
          svg.appendChild(path);

          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', startX);
          dot.setAttribute('cy', startY);
          dot.setAttribute('r', 4);
          svg.appendChild(dot);
        });
      });
    }

    function scheduleMindmapRedraw(delay = 120) {
      window.clearTimeout(state.mindmapRedrawTimer);
      state.mindmapRedrawTimer = window.setTimeout(drawMindmapConnectors, delay);
    }



    function highlightExampleText(sentence, terms = []) {
      let html = escapeHtml(sentence || '');
      const uniqueTerms = Array.from(new Set((terms || []).filter(Boolean)))
        .sort((a, b) => b.length - a.length);

      uniqueTerms.forEach(term => {
        const safeTerm = escapeHtml(term);
        if (!safeTerm) return;
        html = html.split(safeTerm).join(`<span class="text-teal-600 font-black bg-teal-50 px-1 rounded-md">${safeTerm}</span>`);
      });

      return html;
    }

    function renderApp() {
      const checklistContainer = document.getElementById('checklist-container');
      const detailContainer = document.getElementById('detail-list-container');
      
      let checklistHtml = '';
      let detailHtml = '';

      state.vocabData.forEach(item => {
        checklistHtml += `
          <div class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100/70 border border-slate-200/60 transition shadow-2xs bg-white">
            <div class="flex items-center gap-3 overflow-hidden w-full">
              <input type="checkbox" class="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer">
              <span class="font-mono text-xs text-slate-400 font-semibold">${item.id}</span>
              <span class="font-semibold text-slate-800 cursor-pointer hover:text-teal-600 shrink-0" onclick="t30.speakText('${item.word}')">${item.word} 🔊</span>
              <span class="text-sm text-slate-500 font-medium hideable-meaning meaning-target px-2 py-1 w-full block text-center rounded-md transition duration-150 cursor-pointer" onclick="t30.toggleSingleRedSheet(this, event)" data-en-text="${escapeHtml(item.meaning || '')}" data-vi-text="${escapeHtml(item.meaning_vi || translateToVietnamese(item.meaning || ''))}">${item.meaning}</span>
            </div>
          </div>
        `;

        // Highlight all vocabulary surface forms in the example sentence.
        const highlightedSentence = highlightExampleText(item.example_ko, item.highlight_terms || [item.word]);

        detailHtml += `
          <div class="border border-slate-200 rounded-2xl p-5 shadow-2xs bg-white hover:border-teal-200 transition">
            <div class="flex flex-wrap justify-between items-start gap-4 mb-3">
              <div class="flex items-center gap-3">
                <span class="px-2.5 py-1 bg-teal-600 text-white rounded-lg font-mono text-sm font-bold">${item.id}</span>
                <h3 class="text-2xl font-bold text-slate-900 cursor-pointer hover:text-teal-600" onclick="t30.speakText('${item.word}')">${item.word} 🔊</h3>
                <span class="px-2 py-0.5 bg-[var(--pk2)] text-[var(--pk4)] rounded-md text-xs font-semibold">${item.type}</span>
              </div>
              <span class="text-base font-bold text-teal-600 hideable-meaning meaning-target px-3 py-1 bg-teal-50/50 rounded-lg cursor-pointer" onclick="t30.toggleSingleRedSheet(this, event)" data-en-text="${escapeHtml(item.meaning || '')}" data-vi-text="${escapeHtml(item.meaning_vi || translateToVietnamese(item.meaning || ''))}">${item.meaning}</span>
            </div>

            <div class="bg-slate-50/80 rounded-xl p-4 cursor-pointer hover:bg-teal-50/40 transition border border-slate-100 mb-3" onclick="t30.speakText('${item.example_ko}')">
              <p class="font-semibold text-slate-800 text-base mb-1.5">${highlightedSentence} 🔊</p>
              <p class="text-slate-600 text-sm leading-relaxed hideable-meaning vi-meaning-target" onclick="t30.toggleSingleRedSheet(this, event)" data-en-text="${escapeHtml(item.example_vi || '')}" data-vi-text="${escapeHtml(item.example_vi_vn || translateToVietnamese(item.example_vi || ''))}">${item.example_vi}</p>
            </div>

            ${renderDetailExtras(item)}
            ${item.extra ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-500 bg-slate-50/30 p-4 rounded-xl border border-slate-100 leading-relaxed">${item.extra}</div>` : ''}
          </div>
        `;
      });

      checklistContainer.innerHTML = checklistHtml;
      detailContainer.innerHTML = detailHtml;
      applyTranslationLanguage();
      scheduleMindmapRedraw(180);
    }

  function mount(container, data) {
    if (!container) return;
    state.container = container;
    state.vocabData = (data && data.vocabData) || [];
    state.dict = (data && data.dict) || {};
    state.reviewChecked = false;
    state.selectedMatchingCards = [];

    renderApp();
    applyTranslationLanguage();
    updateReviewLanguageMode();
    setShowAnswersEnabled(state.reviewChecked);
    setReviewChoiceTranslationsVisible(false);

    container.querySelectorAll('.review-input').forEach(input => {
      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          checkReviewAnswers();
        }
      });
    });
    container.querySelectorAll('input[type="radio"][name^="review-choice-"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const no = radio.name.replace('review-choice-', '');
        selectReviewRadio(no, radio.value);
      });
    });

    scheduleMindmapRedraw(260);
  }

  window.addEventListener('resize', () => scheduleMindmapRedraw(120));
  window.addEventListener('load', () => scheduleMindmapRedraw(220));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => scheduleMindmapRedraw(120));
  }

  window.t30 = {
    mount,
    speakText,
    switchTab,
    toggleSingleRedSheet,
    toggleVietnameseInTab,
    toggleTranslationLanguage,
    checkReviewAnswers,
    resetReviewAnswers,
    showReviewAnswers,
    selectReviewRadio,
    selectReviewChoice,
    selectMatchingCard
  };
})();
