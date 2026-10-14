/**
 * NPTEL Deep Learning for Computer Vision - Quiz Master Engine
 * Covers all 15 Blocks (Pages 1 - 143) with 336 Authentic PYQs & Assignments
 */

(function () {
  'use strict';

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const state = {
    currentBlock: null,
    currentQuestionIndex: 0,
    quizMode: 'practice', // 'practice' | 'exam'
    userAnswers: {},     // { [questionId]: optionIndex }
    flaggedQuestions: new Set(),
    activeFilter: 'all',
    searchFilter: 'all',
    timerInterval: null,
    secondsRemaining: 900,
    soundEnabled: true,
    theme: localStorage.getItem('dl4cv_theme') || 'dark',
    userProgress: JSON.parse(localStorage.getItem('dl4cv_progress') || '{}'),
    isReviewMode: false,
    activeQuestionsList: [],
    shuffleEnabled: localStorage.getItem('dl4cv_shuffle') === 'true'
  };

  const getQuizData = () => window.QUIZ_DATA || (typeof QUIZ_DATA !== 'undefined' ? QUIZ_DATA : []);

  // Fisher-Yates shuffle algorithm
  function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function shuffleQuestionsAndOptions(questions) {
    return shuffleArray(questions).map(q => {
      // Map options to objects tracking correct answer
      const mapped = q.options.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === q.correctIndex
      }));
      const shuffledMapped = shuffleArray(mapped);
      const newCorrectIndex = shuffledMapped.findIndex(m => m.isCorrect);
      return {
        ...q,
        options: shuffledMapped.map(m => m.text),
        correctIndex: newCorrectIndex
      };
    });
  }

  // ==========================================
  // AUDIO SYNTHESIZER (Web Audio API)
  // No external assets required
  // ==========================================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'correct') {
        // High harmonic chime (Major third)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'wrong') {
        // Low soft tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.exponentialRampToValueAtTime(174.61, now + 0.15); // F3
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'click') {
        // Subtle click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      console.warn("Audio playback not supported or blocked:", e);
    }
  }

  // ==========================================
  // DOM ELEMENT REFERENCES
  // ==========================================
  const elements = {
    // Views
    viewDashboard: document.getElementById('view-dashboard'),
    viewPlayer: document.getElementById('view-player'),
    viewResult: document.getElementById('view-result'),

    // Header & Controls
    btnBrandHome: document.getElementById('btn-brand-home'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    soundIcon: document.getElementById('sound-icon'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    btnResetStats: document.getElementById('btn-reset-stats'),
    btnOpenSearch: document.getElementById('btn-open-search'),

    // Dashboard Stats
    statTotalQuizzes: document.getElementById('stat-total-quizzes'),
    statTotalQuestions: document.getElementById('stat-total-questions'),
    statCompletedBlocks: document.getElementById('stat-completed-blocks'),
    statAvgScore: document.getElementById('stat-avg-score'),
    blocksGrid: document.getElementById('blocks-grid'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    btnMegaMock: document.getElementById('btn-mega-mock'),
    btnToggleShuffleMode: document.getElementById('btn-toggle-shuffle-mode'),
    shuffleModeLabel: document.getElementById('shuffle-mode-label'),

    // Player Elements
    btnExitQuiz: document.getElementById('btn-exit-quiz'),
    playerBlockTitle: document.getElementById('player-block-title'),
    playerBlockSubtitle: document.getElementById('player-block-subtitle'),
    playerTimerBadge: document.getElementById('player-timer-badge'),
    playerTimerText: document.getElementById('player-timer-text'),
    playerModeBadge: document.getElementById('player-mode-badge'),
    btnFlagQuestion: document.getElementById('btn-flag-question'),
    flagIcon: document.getElementById('flag-icon'),
    btnShuffleQuestions: document.getElementById('btn-shuffle-questions'),
    btnTogglePalette: document.getElementById('btn-toggle-palette'),
    btnClosePalette: document.getElementById('btn-close-palette'),
    paletteSidebar: document.getElementById('palette-sidebar'),
    paletteGrid: document.getElementById('palette-grid'),
    quizProgressFill: document.getElementById('quiz-progress-fill'),

    // Question Box
    qNumberIndicator: document.getElementById('q-number-indicator'),
    qSourceIndicator: document.getElementById('q-source-indicator'),
    qStatusIndicator: document.getElementById('q-status-indicator'),
    questionPrompt: document.getElementById('question-prompt'),
    optionsList: document.getElementById('options-list'),
    explanationBox: document.getElementById('explanation-box'),
    explanationText: document.getElementById('explanation-text'),

    // Footer Player Controls
    btnPrevQ: document.getElementById('btn-prev-q'),
    btnNextQ: document.getElementById('btn-next-q'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    btnSubmitQuiz: document.getElementById('btn-submit-quiz'),

    // Results
    resultBlockTitle: document.getElementById('result-block-title'),
    resultBlockSubtitle: document.getElementById('result-block-subtitle'),
    resultPercentage: document.getElementById('result-percentage'),
    resultFraction: document.getElementById('result-fraction'),
    resultVerdict: document.getElementById('result-verdict'),
    resCorrectCount: document.getElementById('res-correct-count'),
    resWrongCount: document.getElementById('res-wrong-count'),
    resSkippedCount: document.getElementById('res-skipped-count'),
    resTimeTaken: document.getElementById('res-time-taken'),
    btnReviewQuiz: document.getElementById('btn-review-quiz'),
    btnRetryMistakes: document.getElementById('btn-retry-mistakes'),
    btnRetakeQuiz: document.getElementById('btn-retake-quiz'),
    btnRetakeShuffled: document.getElementById('btn-retake-shuffled'),
    btnReturnHome: document.getElementById('btn-return-home'),

    // Search Modal
    searchModal: document.getElementById('search-modal'),
    globalSearchInput: document.getElementById('global-search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    btnCloseSearchModal: document.getElementById('btn-close-search-modal'),
    searchResultsList: document.getElementById('search-results-list'),
    searchResultsCount: document.getElementById('search-results-count'),
    searchFilterChips: document.querySelectorAll('[data-search-filter]'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    applyTheme(state.theme);
    updateSoundUI();
    updateShuffleUI();
    renderDashboard();
    setupEventListeners();
  }

  // ==========================================
  // THEME & SOUND MANAGEMENT
  // ==========================================
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('dl4cv_theme', theme);
    if (theme === 'dark') {
      elements.themeIcon.className = 'bi bi-sun-fill';
    } else {
      elements.themeIcon.className = 'bi bi-moon-stars-fill';
    }
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme} mode`);
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    updateSoundUI();
    showToast(state.soundEnabled ? 'Sound feedback enabled' : 'Sound muted');
  }

  function updateSoundUI() {
    if (state.soundEnabled) {
      elements.soundIcon.className = 'bi bi-volume-up-fill';
      elements.btnSoundToggle.classList.remove('muted');
    } else {
      elements.soundIcon.className = 'bi bi-volume-mute-fill';
      elements.btnSoundToggle.classList.add('muted');
    }
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'bi-info-circle-fill';
    if (type === 'success') icon = 'bi-check-circle-fill';
    if (type === 'warn') icon = 'bi-exclamation-triangle-fill';

    toast.innerHTML = `<i class="bi ${icon}"></i> <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ==========================================
  // DASHBOARD RENDERING
  // ==========================================
  function renderDashboard() {
    const data = window.QUIZ_DATA || (typeof QUIZ_DATA !== 'undefined' ? QUIZ_DATA : null);
    if (!data || !data.length) {
      elements.blocksGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
          <p>Unable to load quiz database. Please ensure quiz_data.js is present.</p>
        </div>`;
      return;
    }

    // Calculate totals
    const totalBlocks = data.length;
    let totalQuestions = 0;
    let completedCount = 0;
    let totalScorePercent = 0;

    data.forEach(b => {
      totalQuestions += b.totalQuestions;
      const prog = state.userProgress[b.id];
      if (prog && prog.completed) {
        completedCount++;
        totalScorePercent += prog.scorePercent;
      }
    });

    const avgScore = completedCount > 0 ? Math.round(totalScorePercent / completedCount) : 0;

    elements.statTotalQuizzes.textContent = totalBlocks;
    elements.statTotalQuestions.textContent = totalQuestions;
    elements.statCompletedBlocks.textContent = `${completedCount} / ${totalBlocks}`;
    elements.statAvgScore.textContent = `${avgScore}%`;

    // Filter cards
    const filteredBlocks = data.filter(b => {
      if (state.activeFilter === 'theory') return b.number <= 5;
      if (state.activeFilter === 'assignments') return b.number > 5;
      return true;
    });

    elements.blocksGrid.innerHTML = filteredBlocks.map(block => {
      const prog = state.userProgress[block.id];
      const hasProgress = prog && prog.completed;
      const scoreBadgeHtml = hasProgress
        ? `<span class="block-score-tag passed"><i class="bi bi-trophy"></i> Best: ${prog.scorePercent}%</span>`
        : `<span class="block-score-tag untested">Not Attempted</span>`;

      return `
        <div class="block-card" data-block-id="${block.id}">
          <div>
            <div class="block-header">
              <span class="block-page-badge"><i class="bi bi-file-text"></i> ${block.pageRange}</span>
              <span class="block-focus-badge">${block.badge}</span>
            </div>
            <h3 class="block-title">${block.title}</h3>
            <p class="block-subtitle">${block.subtitle}</p>
          </div>

          <div>
            <div class="block-meta">
              <div class="block-meta-item">
                <i class="bi bi-question-diamond-fill"></i>
                <span>${block.totalQuestions} Questions</span>
              </div>
              ${scoreBadgeHtml}
            </div>

            <div class="block-actions">
              <button class="btn btn-secondary btn-start-practice" data-block-id="${block.id}">
                <i class="bi bi-book-half"></i> Practice
              </button>
              <button class="btn btn-primary btn-start-exam" data-block-id="${block.id}">
                <i class="bi bi-stopwatch"></i> Timed Test
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    elements.blocksGrid.querySelectorAll('.btn-start-practice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const blockId = e.currentTarget.getAttribute('data-block-id');
        startQuiz(blockId, 'practice');
      });
    });

    elements.blocksGrid.querySelectorAll('.btn-start-exam').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const blockId = e.currentTarget.getAttribute('data-block-id');
        startQuiz(blockId, 'exam');
      });
    });
  }

  // ==========================================
  // QUIZ ENGINE & PLAYBACK
  // ==========================================
  function startQuiz(blockId, mode = 'practice', customQuestions = null, forceShuffle = false) {
    const data = getQuizData();
    let block;
    if (blockId === 'mega_mock') {
      // Pick 2 questions from each of the 15 blocks (30 questions total)
      const mockQs = [];
      data.forEach(b => {
        const shuffled = shuffleQuestionsAndOptions(b.questions);
        mockQs.push(...shuffled.slice(0, 2));
      });
      block = {
        id: 'mega_mock',
        title: 'Mega Mock Test: All 143 Pages',
        subtitle: 'Comprehensive 30-Question Final Assessment Across All 15 Blocks',
        pageRange: 'Pages 1 - 143',
        totalQuestions: mockQs.length,
        questions: mockQs
      };
    } else {
      block = data.find(b => b.id === blockId);
    }

    if (!block) return;

    state.currentBlock = block;
    state.quizMode = mode;
    state.isReviewMode = false;

    let baseQuestions = customQuestions || [...block.questions];
    if (state.shuffleEnabled || forceShuffle) {
      baseQuestions = shuffleQuestionsAndOptions(baseQuestions);
    }

    state.activeQuestionsList = baseQuestions;
    state.currentQuestionIndex = 0;
    state.userAnswers = {};
    state.flaggedQuestions.clear();

    // Setup Header info
    elements.playerBlockTitle.textContent = block.title;
    elements.playerBlockSubtitle.textContent = block.subtitle;
    elements.playerModeBadge.textContent = mode === 'exam' ? 'Exam Mode (Timed)' : 'Study & Practice Mode';

    // Timer setup for exam mode
    if (mode === 'exam') {
      elements.playerTimerBadge.style.display = 'inline-flex';
      // 1 minute per question or 20 mins max
      state.secondsRemaining = Math.min(state.activeQuestionsList.length * 60, 1800);
      updateTimerDisplay();
      clearInterval(state.timerInterval);
      state.timerInterval = setInterval(handleTimerTick, 1000);
    } else {
      elements.playerTimerBadge.style.display = 'none';
      clearInterval(state.timerInterval);
    }

    // Switch view
    switchView('player');
    renderQuestion(0);
    renderPalette();
  }

  function handleTimerTick() {
    state.secondsRemaining--;
    updateTimerDisplay();
    if (state.secondsRemaining <= 0) {
      clearInterval(state.timerInterval);
      showToast('Time is up! Submitting your exam automatically.', 'warn');
      finishQuiz();
    }
  }

  function updateTimerDisplay() {
    const mins = Math.floor(state.secondsRemaining / 60);
    const secs = state.secondsRemaining % 60;
    elements.playerTimerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function renderQuestion(index) {
    if (index < 0 || index >= state.activeQuestionsList.length) return;
    state.currentQuestionIndex = index;

    const q = state.activeQuestionsList[index];
    const total = state.activeQuestionsList.length;

    // Update Progress
    const progressPercent = ((index + 1) / total) * 100;
    elements.quizProgressFill.style.width = `${progressPercent}%`;

    // Indicators
    elements.qNumberIndicator.textContent = `Question ${index + 1} of ${total}`;
    elements.qSourceIndicator.innerHTML = `<i class="bi bi-book"></i> Ref: ${q.pageRange || state.currentBlock.pageRange}`;

    const isAnswered = state.userAnswers.hasOwnProperty(q.id);
    const isFlagged = state.flaggedQuestions.has(q.id);

    if (isFlagged) {
      elements.qStatusIndicator.className = 'q-status-pill flagged';
      elements.qStatusIndicator.textContent = 'Flagged';
      elements.flagIcon.className = 'bi bi-flag-fill';
      elements.btnFlagQuestion.classList.add('flagged');
    } else if (isAnswered) {
      elements.qStatusIndicator.className = 'q-status-pill answered';
      elements.qStatusIndicator.textContent = 'Answered';
      elements.flagIcon.className = 'bi bi-flag';
      elements.btnFlagQuestion.classList.remove('flagged');
    } else {
      elements.qStatusIndicator.className = 'q-status-pill';
      elements.qStatusIndicator.textContent = 'Pending';
      elements.flagIcon.className = 'bi bi-flag';
      elements.btnFlagQuestion.classList.remove('flagged');
    }

    // Question Prompt
    elements.questionPrompt.textContent = q.question;

    // Options rendering
    const optLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    elements.optionsList.innerHTML = q.options.map((optText, optIdx) => {
      let optionClass = 'option-item';
      const userSelected = state.userAnswers[q.id];

      if (state.quizMode === 'practice' || state.isReviewMode) {
        if (isAnswered || state.isReviewMode) {
          if (optIdx === q.correctIndex) {
            optionClass += ' correct';
          } else if (userSelected === optIdx) {
            optionClass += ' wrong';
          }
        } else if (userSelected === optIdx) {
          optionClass += ' selected';
        }
      } else {
        // Exam mode: only show selected
        if (userSelected === optIdx) {
          optionClass += ' selected';
        }
      }

      return `
        <div class="${optionClass}" data-opt-index="${optIdx}">
          <div class="option-key">${optLetters[optIdx] || optIdx + 1}</div>
          <div class="option-text">${optText}</div>
        </div>
      `;
    }).join('');

    // Attach click listeners to options
    elements.optionsList.querySelectorAll('.option-item').forEach(item => {
      item.addEventListener('click', () => {
        const selectedIdx = parseInt(item.getAttribute('data-opt-index'), 10);
        selectOption(q, selectedIdx);
      });
    });

    // Explanation Box
    if ((state.quizMode === 'practice' && isAnswered) || state.isReviewMode) {
      elements.explanationBox.classList.add('visible');
      elements.explanationText.innerHTML = `
        <p style="margin-bottom: 0.5rem;"><strong>Accepted Answer:</strong> ${escapeHtml(q.acceptedAnswer || q.options[q.correctIndex])}</p>
        <p>${escapeHtml(q.explanation)}</p>
      `;
    } else {
      elements.explanationBox.classList.remove('visible');
    }

    // Navigation Buttons State
    elements.btnPrevQ.disabled = index === 0;
    if (index === total - 1) {
      elements.btnNextQ.style.display = 'none';
      elements.btnSubmitQuiz.style.display = 'inline-flex';
    } else {
      elements.btnNextQ.style.display = 'inline-flex';
      elements.btnSubmitQuiz.style.display = 'none';
    }

    renderPalette();
  }

  function selectOption(q, optIndex) {
    if (state.isReviewMode) return; // Cannot change in review mode

    const isFirstAttempt = !state.userAnswers.hasOwnProperty(q.id);
    state.userAnswers[q.id] = optIndex;

    if (state.quizMode === 'practice') {
      if (optIndex === q.correctIndex) {
        playSound('correct');
      } else {
        playSound('wrong');
      }
    } else {
      playSound('click');
    }

    renderQuestion(state.currentQuestionIndex);
  }

  function toggleFlagCurrentQuestion() {
    const q = state.activeQuestionsList[state.currentQuestionIndex];
    if (state.flaggedQuestions.has(q.id)) {
      state.flaggedQuestions.delete(q.id);
      showToast('Question unflagged');
    } else {
      state.flaggedQuestions.add(q.id);
      showToast('Question flagged for review');
    }
    renderQuestion(state.currentQuestionIndex);
  }

  function clearCurrentSelection() {
    const q = state.activeQuestionsList[state.currentQuestionIndex];
    if (state.userAnswers.hasOwnProperty(q.id)) {
      delete state.userAnswers[q.id];
      renderQuestion(state.currentQuestionIndex);
      showToast('Selection cleared');
    }
  }

  // ==========================================
  // QUESTION PALETTE
  // ==========================================
  function renderPalette() {
    const total = state.activeQuestionsList.length;
    elements.paletteGrid.innerHTML = '';

    for (let i = 0; i < total; i++) {
      const q = state.activeQuestionsList[i];
      const isCurrent = i === state.currentQuestionIndex;
      const isAnswered = state.userAnswers.hasOwnProperty(q.id);
      const isFlagged = state.flaggedQuestions.has(q.id);

      let btnClass = 'palette-btn';
      if (isCurrent) btnClass += ' current';
      if (isAnswered) btnClass += ' answered';
      if (isFlagged) btnClass += ' flagged';

      const btn = document.createElement('button');
      btn.className = btnClass;
      btn.textContent = i + 1;
      btn.title = `Jump to Question ${i + 1}`;
      btn.addEventListener('click', () => {
        renderQuestion(i);
        if (window.innerWidth <= 900) {
          elements.paletteSidebar.classList.remove('open');
        }
      });

      elements.paletteGrid.appendChild(btn);
    }
  }

  // ==========================================
  // QUIZ SUBMISSION & SCORECARD
  // ==========================================
  function finishQuiz() {
    clearInterval(state.timerInterval);

    const questions = state.activeQuestionsList;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    questions.forEach(q => {
      if (state.userAnswers.hasOwnProperty(q.id)) {
        if (state.userAnswers[q.id] === q.correctIndex) {
          correct++;
        } else {
          wrong++;
        }
      } else {
        skipped++;
      }
    });

    const total = questions.length;
    const scorePercent = Math.round((correct / total) * 100);

    // Save progress to local storage
    if (state.currentBlock && state.currentBlock.id !== 'mega_mock') {
      const prevProg = state.userProgress[state.currentBlock.id] || {};
      state.userProgress[state.currentBlock.id] = {
        completed: true,
        lastAttempt: new Date().toISOString(),
        scorePercent: Math.max(scorePercent, prevProg.scorePercent || 0),
        totalAnswered: Object.keys(state.userAnswers).length,
        totalQuestions: total
      };
      localStorage.setItem('dl4cv_progress', JSON.stringify(state.userProgress));
    }

    // Populate Results
    elements.resultBlockTitle.textContent = state.currentBlock.title;
    elements.resultBlockSubtitle.textContent = state.currentBlock.subtitle;
    elements.resultPercentage.textContent = `${scorePercent}%`;
    elements.resultFraction.textContent = `${correct} / ${total} Correct`;

    elements.resCorrectCount.textContent = correct;
    elements.resWrongCount.textContent = wrong;
    elements.resSkippedCount.textContent = skipped;

    // Time calculation
    elements.resTimeTaken.textContent = state.quizMode === 'exam'
      ? `${Math.floor((state.activeQuestionsList.length * 60 - state.secondsRemaining) / 60)}m ${(state.activeQuestionsList.length * 60 - state.secondsRemaining) % 60}s`
      : 'Untimed Practice';

    // Verdict
    if (scorePercent >= 85) {
      elements.resultVerdict.innerHTML = '🌟 <strong>Elite + Gold Candidate!</strong> Exceptional mastery of this 10-page block!';
      playSound('correct');
    } else if (scorePercent >= 60) {
      elements.resultVerdict.innerHTML = '👍 <strong>Great Job!</strong> You are well prepared for NPTEL exam certification.';
    } else {
      elements.resultVerdict.innerHTML = '💡 <strong>Needs Revision!</strong> Review the solutions and lecture notes for these pages.';
    }

    switchView('result');
  }

  // ==========================================
  // REVIEW MODE & RETRY MISTAKES
  // ==========================================
  function enterReviewMode() {
    state.isReviewMode = true;
    switchView('player');
    renderQuestion(0);
    showToast('Reviewing solutions with official explanations');
  }

  function retryMistakesOnly() {
    const wrongQuestions = state.activeQuestionsList.filter(q => {
      const ans = state.userAnswers[q.id];
      return ans !== undefined && ans !== q.correctIndex;
    });

    if (wrongQuestions.length === 0) {
      showToast('No mistakes found to retry!', 'success');
      return;
    }

    startQuiz(state.currentBlock.id, 'practice', wrongQuestions);
    showToast(`Retrying ${wrongQuestions.length} missed questions`);
  }

  // ==========================================
  // SHUFFLE MANAGEMENT
  // ==========================================
  function triggerDynamicShuffle() {
    if (state.isReviewMode) {
      showToast('Cannot shuffle in review mode', 'warn');
      return;
    }
    if (elements.btnShuffleQuestions) {
      elements.btnShuffleQuestions.classList.add('spinning');
      setTimeout(() => elements.btnShuffleQuestions.classList.remove('spinning'), 500);
    }

    state.activeQuestionsList = shuffleQuestionsAndOptions(state.activeQuestionsList);
    state.currentQuestionIndex = 0;
    state.userAnswers = {};
    renderQuestion(0);
    renderPalette();
    playSound('click');
    showToast('Questions and options shuffled! 🔀', 'success');
  }

  function toggleDashboardShuffle() {
    state.shuffleEnabled = !state.shuffleEnabled;
    localStorage.setItem('dl4cv_shuffle', state.shuffleEnabled ? 'true' : 'false');
    updateShuffleUI();
    showToast(state.shuffleEnabled ? 'Automatic shuffle enabled for all quizzes! 🔀' : 'Automatic shuffle disabled', 'info');
  }

  function updateShuffleUI() {
    if (elements.shuffleModeLabel) {
      elements.shuffleModeLabel.textContent = state.shuffleEnabled ? 'Shuffle: ON' : 'Shuffle: OFF';
    }
    if (elements.btnToggleShuffleMode) {
      if (state.shuffleEnabled) {
        elements.btnToggleShuffleMode.classList.add('btn-primary');
        elements.btnToggleShuffleMode.classList.remove('btn-secondary');
        elements.btnToggleShuffleMode.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.4)';
      } else {
        elements.btnToggleShuffleMode.classList.remove('btn-primary');
        elements.btnToggleShuffleMode.classList.add('btn-secondary');
        elements.btnToggleShuffleMode.style.boxShadow = 'none';
      }
    }
  }

  // ==========================================
  // SEARCH / QUESTION BANK
  // ==========================================
  function openSearchModal() {
    elements.searchModal.classList.add('open');
    elements.globalSearchInput.focus();
    performSearch(elements.globalSearchInput.value.trim());
  }

  function closeSearchModal() {
    elements.searchModal.classList.remove('open');
  }

  function performSearch(query) {
    const data = getQuizData();
    if (!data.length) return;

    let allQuestions = [];
    data.forEach(b => {
      if (state.searchFilter === 'b1_5' && b.number > 5) return;
      if (state.searchFilter === 'b6_15' && b.number <= 5) return;
      b.questions.forEach(q => {
        allQuestions.push({
          ...q,
          blockTitle: b.title,
          blockPageRange: b.pageRange
        });
      });
    });

    if (!query) {
      elements.searchResultsCount.textContent = `Browsing ${allQuestions.length} total questions`;
      renderSearchResults(allQuestions.slice(0, 12));
      return;
    }

    const qLower = query.toLowerCase();
    const matches = allQuestions.filter(q => {
      return q.question.toLowerCase().includes(qLower) ||
        q.options.some(opt => opt.toLowerCase().includes(qLower)) ||
        (q.acceptedAnswer && q.acceptedAnswer.toLowerCase().includes(qLower)) ||
        (q.explanation && q.explanation.toLowerCase().includes(qLower));
    });

    elements.searchResultsCount.textContent = `Found ${matches.length} matching questions`;
    renderSearchResults(matches.slice(0, 25), query);
  }

  function renderSearchResults(results, highlightQuery = '') {
    if (!results.length) {
      elements.searchResultsList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="bi bi-search" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          No questions found matching your search.
        </div>`;
      return;
    }

    elements.searchResultsList.innerHTML = results.map(q => {
      let qText = escapeHtml(q.question);
      if (highlightQuery) {
        const regex = new RegExp(`(${highlightQuery})`, 'gi');
        qText = qText.replace(regex, '<mark style="background: rgba(56, 189, 248, 0.3); color: #fff; padding: 0 3px; border-radius: 2px;">$1</mark>');
      }

      return `
        <div class="search-item">
          <div class="search-item-meta">
            <span class="search-item-pill">${escapeHtml(q.blockPageRange)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(q.blockTitle)}</span>
          </div>
          <div class="search-item-title">${qText}</div>
          <div class="search-item-answer">
            <i class="bi bi-check-circle-fill"></i> <strong>Ans:</strong> ${escapeHtml(q.acceptedAnswer || q.options[q.correctIndex])}
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // VIEW SWITCHING HELPER
  // ==========================================
  function switchView(viewName) {
    elements.viewDashboard.classList.remove('active');
    elements.viewPlayer.classList.remove('active');
    elements.viewResult.classList.remove('active');

    if (viewName === 'dashboard') {
      elements.viewDashboard.classList.add('active');
      renderDashboard();
    } else if (viewName === 'player') {
      elements.viewPlayer.classList.add('active');
    } else if (viewName === 'result') {
      elements.viewResult.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    // Navigation & Brand
    elements.btnBrandHome.addEventListener('click', () => switchView('dashboard'));
    elements.btnSoundToggle.addEventListener('click', toggleSound);
    elements.btnThemeToggle.addEventListener('click', toggleTheme);

    // Reset All Stats
    elements.btnResetStats.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all your quiz scores and progress?')) {
        localStorage.removeItem('dl4cv_progress');
        state.userProgress = {};
        renderDashboard();
        showToast('All progress has been reset', 'warn');
      }
    });

    // Dashboard Filters
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeFilter = tab.getAttribute('data-filter');
        renderDashboard();
      });
    });

    // Mega Mock Button
    elements.btnMegaMock.addEventListener('click', () => {
      startQuiz('mega_mock', 'exam');
    });

    // Player Header Controls
    elements.btnExitQuiz.addEventListener('click', () => {
      if (confirm('Do you want to exit to the blocks catalog? Your progress in this quiz will be lost.')) {
        clearInterval(state.timerInterval);
        switchView('dashboard');
      }
    });

    elements.btnFlagQuestion.addEventListener('click', toggleFlagCurrentQuestion);
    elements.btnTogglePalette.addEventListener('click', () => {
      elements.paletteSidebar.classList.toggle('open');
    });
    elements.btnClosePalette.addEventListener('click', () => {
      elements.paletteSidebar.classList.remove('open');
    });

    // Player Footer Controls
    elements.btnPrevQ.addEventListener('click', () => {
      if (state.currentQuestionIndex > 0) {
        renderQuestion(state.currentQuestionIndex - 1);
      }
    });

    elements.btnNextQ.addEventListener('click', () => {
      if (state.currentQuestionIndex < state.activeQuestionsList.length - 1) {
        renderQuestion(state.currentQuestionIndex + 1);
      }
    });

    elements.btnClearSelection.addEventListener('click', clearCurrentSelection);
    elements.btnSubmitQuiz.addEventListener('click', () => {
      const unanswered = state.activeQuestionsList.length - Object.keys(state.userAnswers).length;
      let promptMsg = 'Are you ready to submit your quiz?';
      if (unanswered > 0) {
        promptMsg = `You have ${unanswered} unanswered question(s). Are you sure you want to submit?`;
      }
      if (confirm(promptMsg)) {
        finishQuiz();
      }
    });

    // Shuffle Controls
    if (elements.btnToggleShuffleMode) {
      elements.btnToggleShuffleMode.addEventListener('click', toggleDashboardShuffle);
    }
    if (elements.btnShuffleQuestions) {
      elements.btnShuffleQuestions.addEventListener('click', triggerDynamicShuffle);
    }
    if (elements.btnRetakeShuffled) {
      elements.btnRetakeShuffled.addEventListener('click', () => {
        startQuiz(state.currentBlock.id, state.quizMode, null, true);
      });
    }

    // Result Actions
    elements.btnReviewQuiz.addEventListener('click', enterReviewMode);
    elements.btnRetryMistakes.addEventListener('click', retryMistakesOnly);
    elements.btnRetakeQuiz.addEventListener('click', () => {
      startQuiz(state.currentBlock.id, state.quizMode);
    });
    elements.btnReturnHome.addEventListener('click', () => switchView('dashboard'));

    // Global Search Modal
    elements.btnOpenSearch.addEventListener('click', openSearchModal);
    elements.btnCloseSearchModal.addEventListener('click', closeSearchModal);
    elements.btnClearSearch.addEventListener('click', () => {
      elements.globalSearchInput.value = '';
      performSearch('');
      elements.globalSearchInput.focus();
    });

    elements.globalSearchInput.addEventListener('input', (e) => {
      performSearch(e.target.value.trim());
    });

    elements.searchFilterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        elements.searchFilterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.searchFilter = chip.getAttribute('data-search-filter');
        performSearch(elements.globalSearchInput.value.trim());
      });
    });

    // Close modal on click outside
    elements.searchModal.addEventListener('click', (e) => {
      if (e.target === elements.searchModal) {
        closeSearchModal();
      }
    });

    // Keyboard Shortcuts (Ctrl+K, Numbers 1-4, N, P, F, S)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
        return;
      }

      if (e.key === 'Escape') {
        if (elements.searchModal.classList.contains('open')) {
          closeSearchModal();
        }
        return;
      }

      // If active in player and not typing in an input
      if (elements.viewPlayer.classList.contains('active') && document.activeElement.tagName !== 'INPUT') {
        const q = state.activeQuestionsList[state.currentQuestionIndex];
        if (!q) return;

        // Keys 1 to 4 or A to D
        if (['1', '2', '3', '4'].includes(e.key)) {
          const optIdx = parseInt(e.key, 10) - 1;
          if (optIdx < q.options.length) {
            selectOption(q, optIdx);
          }
        } else if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
          const optIdx = e.key.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
          if (optIdx < q.options.length) {
            selectOption(q, optIdx);
          }
        } else if (e.key.toLowerCase() === 'n' || e.key === 'ArrowRight') {
          if (state.currentQuestionIndex < state.activeQuestionsList.length - 1) {
            renderQuestion(state.currentQuestionIndex + 1);
          }
        } else if (e.key.toLowerCase() === 'p' || e.key === 'ArrowLeft') {
          if (state.currentQuestionIndex > 0) {
            renderQuestion(state.currentQuestionIndex - 1);
          }
        } else if (e.key.toLowerCase() === 'f') {
          toggleFlagCurrentQuestion();
        } else if (e.key.toLowerCase() === 's') {
          triggerDynamicShuffle();
        }
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
