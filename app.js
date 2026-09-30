/**
 * OPIC Master - 100% Standalone Offline Edition
 * Zero External Dependencies, Zero Network Requests.
 */

const state = {
  questions: [],
  filteredQuestions: [],
  currentIndex: 0,
  currentQuestion: null,

  timer: {
    duration: 120,
    remaining: 120,
    intervalId: null,
    isRunning: false
  },

  voice: {
    synth: window.speechSynthesis,
    voices: [],
    selectedVoice: null,
    rate: 1.0,
    isSpeaking: false,
    recognition: null,
    isRecording: false
  },

  history: []
};

// DOM References
const DOM = {
  filterLevel: document.getElementById('filterLevel'),
  filterTopic: document.getElementById('filterTopic'),
  searchInput: document.getElementById('searchInput'),
  btnRandom: document.getElementById('btnRandom'),

  qLevelBadge: document.getElementById('qLevelBadge'),
  qTopicBadge: document.getElementById('qTopicBadge'),
  qTypeBadge: document.getElementById('qTypeBadge'),
  qCounter: document.getElementById('qCounter'),
  qText: document.getElementById('qText'),
  btnPrevQ: document.getElementById('btnPrevQ'),
  btnNextQ: document.getElementById('btnNextQ'),
  btnShuffleQ: document.getElementById('btnShuffleQ'),

  // TTS
  ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
  ttsRateSlider: document.getElementById('ttsRateSlider'),
  ttsRateValue: document.getElementById('ttsRateValue'),
  btnTtsPlay: document.getElementById('btnTtsPlay'),
  btnTtsPlayText: document.getElementById('btnTtsPlayText'),
  btnTtsPause: document.getElementById('btnTtsPause'),
  btnTtsStop: document.getElementById('btnTtsStop'),
  ttsStatus: document.getElementById('ttsStatus'),

  // Sample Answer
  btnToggleSampleAnswer: document.getElementById('btnToggleSampleAnswer'),
  sampleToggleIcon: document.getElementById('sampleToggleIcon'),
  sampleAnswerContainer: document.getElementById('sampleAnswerContainer'),
  sampleAnswerText: document.getElementById('sampleAnswerText'),
  btnListenSample: document.getElementById('btnListenSample'),

  // Timer & Answer
  timerDisplay: document.getElementById('timerDisplay'),
  btnTimerStart: document.getElementById('btnTimerStart'),
  btnTimerReset: document.getElementById('btnTimerReset'),
  timerPresetSelect: document.getElementById('timerPresetSelect'),
  speechIndicator: document.getElementById('speechIndicator'),
  userAnswerInput: document.getElementById('userAnswerInput'),
  wordCount: document.getElementById('wordCount'),
  charCount: document.getElementById('charCount'),
  btnMicToggle: document.getElementById('btnMicToggle'),
  micBtnText: document.getElementById('micBtnText'),
  btnListenAnswer: document.getElementById('btnListenAnswer'),
  btnClearAnswer: document.getElementById('btnClearAnswer'),
  btnSavePractice: document.getElementById('btnSavePractice'),
  btnExportTxt: document.getElementById('btnExportTxt'),
  historyList: document.getElementById('historyList'),
  historyCount: document.getElementById('historyCount'),
  btnClearHistory: document.getElementById('btnClearHistory')
};

// ==========================================
// 1. DATA INITIALIZATION
// ==========================================
function initData() {
  if (window.DEFAULT_OPIC_QUESTIONS && Array.isArray(window.DEFAULT_OPIC_QUESTIONS)) {
    state.questions = window.DEFAULT_OPIC_QUESTIONS;
  } else {
    state.questions = [
      {
        id: "offline_sample_1",
        targetLevel: "IH-AL",
        topic: "Work",
        type: "Combo-3",
        question: "You indicated in the survey that you work.\nDescribe your company in detail. What kind of company is it? Where is it located?",
        sampleAnswer: "I work for a large technology enterprise headquartered in Hanoi..."
      }
    ];
  }

  populateTopics();
  applyFilters();
  loadHistory();
}

function populateTopics() {
  const topics = new Set();
  state.questions.forEach(q => {
    if (q.topic) topics.add(q.topic);
  });

  const sorted = Array.from(topics).sort();
  DOM.filterTopic.innerHTML = '<option value="ALL">Tất cả chủ đề</option>';
  sorted.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    DOM.filterTopic.appendChild(opt);
  });
}

function applyFilters() {
  const level = DOM.filterLevel.value;
  const topic = DOM.filterTopic.value;
  const search = DOM.searchInput.value.trim().toLowerCase();

  state.filteredQuestions = state.questions.filter(q => {
    if (level !== 'ALL' && q.targetLevel !== level) return false;
    if (topic !== 'ALL' && q.topic !== topic) return false;
    if (search) {
      const text = (q.question || '').toLowerCase();
      const tName = (q.topic || '').toLowerCase();
      if (!text.includes(search) && !tName.includes(search)) return false;
    }
    return true;
  });

  if (state.filteredQuestions.length === 0) {
    DOM.qText.textContent = 'Không tìm thấy câu hỏi phù hợp. Vui lòng chọn lại bộ lọc.';
    DOM.qCounter.textContent = '#0 / 0';
  } else {
    displayQuestion(0);
  }
}

function displayQuestion(index) {
  if (index < 0 || index >= state.filteredQuestions.length) return;
  state.currentIndex = index;
  state.currentQuestion = state.filteredQuestions[index];
  const q = state.currentQuestion;

  DOM.qCounter.textContent = `#${index + 1} / ${state.filteredQuestions.length}`;
  DOM.qLevelBadge.textContent = q.targetLevel || 'IL-IM';
  DOM.qLevelBadge.className = q.targetLevel === 'IH-AL' ? 'badge badge-ih' : 'badge badge-im';
  DOM.qTopicBadge.textContent = q.topic || 'General';
  DOM.qTypeBadge.textContent = q.type || 'Combo-3';
  DOM.qText.textContent = q.question;

  if (q.sampleAnswer && q.sampleAnswer.trim()) {
    DOM.sampleAnswerText.textContent = q.sampleAnswer.trim();
  } else {
    DOM.sampleAnswerText.textContent = 'Chưa có bài mẫu cho câu hỏi này.';
  }

  stopSpeech();
  resetTimer();
}

function selectRandomQuestion() {
  if (state.filteredQuestions.length === 0) return;
  const rand = Math.floor(Math.random() * state.filteredQuestions.length);
  displayQuestion(rand);
}

// ==========================================
// 2. VOICE ENGINE (TTS & STT - OFFLINE)
// ==========================================
function initVoice() {
  state.voice.synth = window.speechSynthesis || null;

  const savedVoiceKey = localStorage.getItem('opic_tts_voice_key') || '';
  const voiceKey = v => [v.name || '', v.lang || '', v.voiceURI || ''].join('||');
  const normalizeLang = lang => String(lang || '').replace(/_/g, '-').toLowerCase();
  const isUS = v => {
    const lang = normalizeLang(v && v.lang);
    return lang === 'en-us' || lang.startsWith('en-us-');
  };

  const rankUSVoice = v => {
    const name = String(v.name || '').toLowerCase();
    const uri = String(v.voiceURI || '').toLowerCase();
    let score = 1000;
    if (name.includes('samsung') || uri.includes('samsung')) score -= 300;
    if (v.localService === true) score -= 200;
    if (v.default === true) score -= 50;
    return score;
  };

  const setStatus = message => {
    if (DOM.ttsStatus) DOM.ttsStatus.textContent = message;
  };

  const loadVoices = () => {
    if (!state.voice.synth || !DOM.ttsVoiceSelect) return [];
    const all = state.voice.synth.getVoices() || [];
    const us = all.filter(isUS).sort((a, b) => {
      const score = rankUSVoice(a) - rankUSVoice(b);
      return score || (a.name || '').localeCompare(b.name || '');
    });

    state.voice.voices = us;
    DOM.ttsVoiceSelect.innerHTML = '';

    if (!us.length) {
      state.voice.selectedVoice = null;
      const opt = document.createElement('option');
      opt.value = '-1';
      opt.textContent = 'Đang tìm voice English (United States)...';
      DOM.ttsVoiceSelect.appendChild(opt);
      setStatus('Đang tìm giọng English (United States)...');
      return us;
    }

    let index = us.findIndex(v => voiceKey(v) === savedVoiceKey);
    if (index < 0 && state.voice.selectedVoice) {
      index = us.findIndex(v => voiceKey(v) === voiceKey(state.voice.selectedVoice));
    }
    if (index < 0) index = 0;

    us.forEach((voice, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${voice.name || `English (US) Voice ${i + 1}`} (${voice.lang})`;
      DOM.ttsVoiceSelect.appendChild(opt);
    });

    DOM.ttsVoiceSelect.value = String(index);
    state.voice.selectedVoice = us[index];
    localStorage.setItem('opic_tts_voice_key', voiceKey(state.voice.selectedVoice));
    setStatus(`American English • ${state.voice.selectedVoice.name || 'Samsung TTS'}`);
    return us;
  };

  const waitForUSVoice = (timeout = 5000) => new Promise(resolve => {
    if (!state.voice.synth) return resolve(null);

    const find = () => {
      const voices = state.voice.synth.getVoices() || [];
      const us = voices.filter(isUS).sort((a, b) => rankUSVoice(a) - rankUSVoice(b));
      if (!us.length) return null;
      loadVoices();
      return state.voice.selectedVoice || us[0];
    };

    const immediate = find();
    if (immediate) return resolve(immediate);

    let done = false;
    let interval = null;
    let timeoutId = null;
    const finish = voice => {
      if (done) return;
      done = true;
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
      try { state.voice.synth.removeEventListener('voiceschanged', onChanged); } catch (e) {}
      resolve(voice || null);
    };
    const onChanged = () => {
      const voice = find();
      if (voice) finish(voice);
    };

    try { state.voice.synth.addEventListener('voiceschanged', onChanged); } catch (e) {}
    interval = setInterval(() => {
      const voice = find();
      if (voice) finish(voice);
    }, 250);
    timeoutId = setTimeout(() => finish(null), timeout);
  });

  loadVoices();
  if (state.voice.synth && 'onvoiceschanged' in state.voice.synth) {
    state.voice.synth.addEventListener('voiceschanged', loadVoices);
  }

  const refresh = () => {
    loadVoices();
    if (!state.voice.selectedVoice) waitForUSVoice(5000).catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('pageshow', refresh);

  DOM.ttsVoiceSelect.addEventListener('change', () => {
    const index = parseInt(DOM.ttsVoiceSelect.value, 10);
    const voice = Number.isInteger(index) ? state.voice.voices[index] : null;
    if (voice && isUS(voice)) {
      state.voice.selectedVoice = voice;
      localStorage.setItem('opic_tts_voice_key', voiceKey(voice));
      setStatus(`American English • ${voice.name || 'Samsung TTS'}`);
    }
  });

  if (DOM.ttsRateSlider) {
    DOM.ttsRateSlider.addEventListener('input', e => {
      state.voice.rate = parseFloat(e.target.value) || 1.0;
      DOM.ttsRateValue.textContent = `${state.voice.rate.toFixed(1)}x`;
    });
  }

  DOM.btnTtsPlay.addEventListener('click', async () => {
    if (!state.voice.synth) return setStatus('Thiết bị/trình duyệt không hỗ trợ đọc');
    if (state.voice.synth.speaking && state.voice.synth.paused) {
      state.voice.synth.resume();
      DOM.btnTtsPlayText.textContent = 'Đang phát âm...';
      return;
    }
    if (state.currentQuestion) await speak(state.currentQuestion.question);
  });

  DOM.btnTtsPause.addEventListener('click', () => {
    if (state.voice.synth && state.voice.synth.speaking) {
      state.voice.synth.pause();
      DOM.btnTtsPlayText.textContent = 'Tiếp tục nghe';
    }
  });
  DOM.btnTtsStop.addEventListener('click', stopSpeech);

  DOM.btnListenSample.addEventListener('click', async () => {
    if (state.currentQuestion && state.currentQuestion.sampleAnswer) await speak(state.currentQuestion.sampleAnswer);
  });
  DOM.btnListenAnswer.addEventListener('click', async () => {
    const text = DOM.userAnswerInput.value.trim();
    if (text) await speak(text);
  });

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    state.voice.recognition = new SpeechRec();
    state.voice.recognition.continuous = true;
    state.voice.recognition.interimResults = true;
    state.voice.recognition.lang = 'en-US';
    state.voice.recognition.onstart = () => {
      state.voice.isRecording = true;
      DOM.btnMicToggle.classList.add('recording');
      DOM.micBtnText.textContent = 'Dừng Micro';
      DOM.speechIndicator.innerHTML = '<span style="color: #dc2626;">● Đang thu âm...</span>';
    };
    state.voice.recognition.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) appendAnswerText(e.results[i][0].transcript.trim());
      }
    };
    state.voice.recognition.onend = () => {
      state.voice.isRecording = false;
      DOM.btnMicToggle.classList.remove('recording');
      DOM.micBtnText.textContent = 'Bật Micro (Nói)';
      DOM.speechIndicator.innerHTML = '<span style="color: #059669;">● Sẵn sàng</span>';
    };
    DOM.btnMicToggle.addEventListener('click', () => {
      if (state.voice.isRecording) state.voice.recognition.stop();
      else {
        try {
          state.voice.recognition.start();
          if (!state.timer.isRunning && state.timer.remaining > 0) startTimer();
        } catch (err) { console.warn('Recognition start error:', err); }
      }
    });
  } else {
    DOM.btnMicToggle.style.opacity = '0.6';
    DOM.speechIndicator.textContent = 'Gõ bài làm trực tiếp';
  }

  waitForUSVoice(5000).catch(() => {});
}

function isAmericanEnglishVoice(voice) {
  if (!voice) return false;
  const lang = String(voice.lang || '').replace(/_/g, '-').toLowerCase();
  return lang === 'en-us' || lang.startsWith('en-us-');
}

async function speak(text) {
  if (!text || !String(text).trim()) return;
  if (!state.voice.synth) {
    if (DOM.ttsStatus) DOM.ttsStatus.textContent = 'Trình duyệt không hỗ trợ đọc';
    return;
  }

  stopSpeech();

  // Re-read the voice list immediately before playback. Chrome on Android
  // can expose installed TTS voices after the first page load.
  const voices = state.voice.synth.getVoices() || [];
  const us = voices.filter(isAmericanEnglishVoice);
  if (us.length) {
    const currentKey = state.voice.selectedVoice
      ? [state.voice.selectedVoice.name || '', state.voice.selectedVoice.lang || '', state.voice.selectedVoice.voiceURI || ''].join('||')
      : '';
    state.voice.selectedVoice = us.find(v =>
      [v.name || '', v.lang || '', v.voiceURI || ''].join('||') === currentKey
    ) || us[0];
  }

  if (!state.voice.selectedVoice || !isAmericanEnglishVoice(state.voice.selectedVoice)) {
    await new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(interval);
        clearTimeout(timeout);
        try { state.voice.synth.removeEventListener('voiceschanged', onChanged); } catch (e) {}
        resolve();
      };
      const find = () => {
        const current = (state.voice.synth.getVoices() || []).filter(isAmericanEnglishVoice);
        if (current.length) {
          state.voice.selectedVoice = current[0];
          loadVoiceSelectionAfterSpeech();
          finish();
        }
      };
      const onChanged = find;
      const interval = setInterval(find, 250);
      const timeout = setTimeout(finish, 5000);
      try { state.voice.synth.addEventListener('voiceschanged', onChanged); } catch (e) {}
      find();
    });
  }

  const selected = state.voice.selectedVoice;
  if (!selected || !isAmericanEnglishVoice(selected)) {
    DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
    DOM.ttsStatus.textContent = 'Chưa thấy voice English (United States). Hãy kiểm tra Samsung TTS đã tải voice chưa.';
    return;
  }

  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.rate = state.voice.rate || 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  utterance.lang = 'en-US';
  utterance.voice = selected;

  utterance.onstart = () => {
    DOM.btnTtsPlayText.textContent = 'Đang phát âm...';
    DOM.ttsStatus.textContent = `🔊 ${selected.name || 'Samsung English US'} (${selected.lang || 'en-US'})`;
  };
  utterance.onend = () => {
    DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
    DOM.ttsStatus.textContent = `American English • ${selected.name || 'Samsung TTS'}`;
  };
  utterance.onerror = event => {
    console.warn('Speech synthesis error:', event);
    DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
    DOM.ttsStatus.textContent = 'Không phát được voice Samsung English (US) — hãy thử Nghe lại.';
  };

  try { state.voice.synth.speak(utterance); }
  catch (err) {
    console.warn('Speech synthesis start error:', err);
    DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
    DOM.ttsStatus.textContent = 'Không phát được voice Samsung English (US)';
  }
}

// Helper used by speak() after Android/Chrome exposes a newly installed voice.
function loadVoiceSelectionAfterSpeech() {
  if (!state.voice.synth || !DOM.ttsVoiceSelect) return;
  const us = (state.voice.synth.getVoices() || []).filter(isAmericanEnglishVoice);
  if (!us.length) return;
  state.voice.voices = us;
  state.voice.selectedVoice = state.voice.selectedVoice && isAmericanEnglishVoice(state.voice.selectedVoice)
    ? state.voice.selectedVoice
    : us[0];
  DOM.ttsVoiceSelect.innerHTML = '';
  us.forEach((voice, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${voice.name || `English (US) Voice ${i + 1}`} (${voice.lang})`;
    DOM.ttsVoiceSelect.appendChild(opt);
  });
  const idx = us.findIndex(v => v.voiceURI === state.voice.selectedVoice.voiceURI);
  DOM.ttsVoiceSelect.value = String(idx >= 0 ? idx : 0);
}

function stopSpeech() {
  if (state.voice.synth) {
    try { state.voice.synth.cancel(); }
    catch (err) { console.warn('Speech synthesis stop error:', err); }
  }
  if (DOM.btnTtsPlayText) DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
  if (DOM.ttsStatus) {
    const voice = state.voice.selectedVoice;
    DOM.ttsStatus.textContent = voice && isAmericanEnglishVoice(voice)
      ? `American English • ${voice.name || 'Samsung TTS'}`
      : 'Đang tìm giọng English (United States)...';
  }
}

function appendAnswerText(phrase) {
  const cur = DOM.userAnswerInput.value;
  DOM.userAnswerInput.value = cur ? `${cur.trim()} ${phrase} ` : `${phrase} `;
  updateStats();
}

// ==========================================
// 3. TIMER ENGINE
// ==========================================
function initTimer() {
  DOM.btnTimerStart.addEventListener('click', () => {
    if (state.timer.isRunning) pauseTimer();
    else startTimer();
  });

  DOM.btnTimerReset.addEventListener('click', resetTimer);

  DOM.timerPresetSelect.addEventListener('change', (e) => {
    state.timer.duration = parseInt(e.target.value, 10);
    resetTimer();
  });
}

function startTimer() {
  if (state.timer.isRunning) return;
  state.timer.isRunning = true;
  DOM.btnTimerStart.textContent = '⏸';

  state.timer.intervalId = setInterval(() => {
    if (state.timer.remaining > 0) {
      state.timer.remaining--;
      renderTimer();
    } else {
      pauseTimer();
      playChime();
      showToast('Hết 2:00 phút trả lời!');
      if (state.voice.isRecording && state.voice.recognition) {
        state.voice.recognition.stop();
      }
    }
  }, 1000);
}

function pauseTimer() {
  state.timer.isRunning = false;
  clearInterval(state.timer.intervalId);
  DOM.btnTimerStart.textContent = '▶';
}

function resetTimer() {
  pauseTimer();
  state.timer.remaining = state.timer.duration;
  renderTimer();
}

function renderTimer() {
  const m = Math.floor(state.timer.remaining / 60);
  const s = state.timer.remaining % 60;
  DOM.timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (state.timer.remaining <= 10) {
    DOM.timerDisplay.className = 'timer-num danger';
  } else if (state.timer.remaining <= 30) {
    DOM.timerDisplay.className = 'timer-num warning';
  } else {
    DOM.timerDisplay.className = 'timer-num';
  }
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {}
}

// ==========================================
// 4. STATS & ANSWER UTILITIES
// ==========================================
function initTextEvents() {
  DOM.userAnswerInput.addEventListener('input', updateStats);

  DOM.btnClearAnswer.addEventListener('click', () => {
    if (confirm('Xóa nội dung trả lời hiện tại?')) {
      DOM.userAnswerInput.value = '';
      updateStats();
    }
  });

  DOM.btnSavePractice.addEventListener('click', savePracticeAnswer);
  DOM.btnExportTxt.addEventListener('click', exportAnswerTxt);

  DOM.btnClearHistory.addEventListener('click', () => {
    if (confirm('Bạn có muốn xóa toàn bộ lịch sử luyện tập trên máy này?')) {
      localStorage.removeItem('opic_offline_history');
      state.history = [];
      renderHistory();
      showToast('Đã làm trống nhật ký luyện tập!');
    }
  });
}

function updateStats() {
  const val = DOM.userAnswerInput.value.trim();
  DOM.charCount.textContent = val.length;
  if (!val) {
    DOM.wordCount.textContent = '0';
    return;
  }
  const words = val.split(/\s+/).filter(Boolean);
  DOM.wordCount.textContent = words.length;
}

// ==========================================
// 5. LOCAL PRACTICE HISTORY (OFFLINE)
// ==========================================
function savePracticeAnswer() {
  const text = DOM.userAnswerInput.value.trim();
  if (!text) {
    showToast('Khung trả lời đang trống, hãy nói hoặc gõ trước khi lưu!');
    return;
  }

  const record = {
    id: Date.now(),
    date: new Date().toLocaleString('vi-VN'),
    questionTitle: state.currentQuestion ? state.currentQuestion.question.slice(0, 70) + '...' : 'Câu hỏi OPIC',
    topic: state.currentQuestion ? state.currentQuestion.topic : 'General',
    level: state.currentQuestion ? state.currentQuestion.targetLevel : 'IH-AL',
    wordCount: DOM.wordCount.textContent,
    answer: text,
    sampleAnswer: state.currentQuestion ? state.currentQuestion.sampleAnswer : ''
  };

  state.history.unshift(record);
  if (state.history.length > 30) state.history.pop(); // keep last 30
  localStorage.setItem('opic_offline_history', JSON.stringify(state.history));
  renderHistory();
  showToast('Đã lưu bài luyện tập thành công!');
}

function loadHistory() {
  const raw = localStorage.getItem('opic_offline_history');
  if (raw) {
    try {
      state.history = JSON.parse(raw);
    } catch (e) {
      state.history = [];
    }
  }
  renderHistory();
}

function renderHistory() {
  DOM.historyCount.textContent = state.history.length;
  if (state.history.length === 0) {
    DOM.historyList.innerHTML = '<p style="font-size: 12px; color: #94a3b8; font-style: italic;">Chưa có bài luyện nào được lưu. Sau khi nói xong, nhấn "Lưu bài luyện" để xem lại tiến độ của bạn!</p>';
    return;
  }

  DOM.historyList.innerHTML = '';
  state.history.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <div class="history-item-top">
        <span>🏷️ ${escapeHtml(item.topic)} (${escapeHtml(item.level)}) - <strong>${item.wordCount} từ</strong></span>
        <span style="font-size: 10px; color: #64748b;">${item.date}</span>
      </div>
      <div style="font-size: 11px; color: #475569; margin-bottom: 4px; font-weight: 600;">${escapeHtml(item.questionTitle)}</div>
      <div style="color: #0f172a; white-space: pre-line; background: #fff; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">${escapeHtml(item.answer)}</div>
    `;
    DOM.historyList.appendChild(el);
  });
}

function exportAnswerTxt() {
  const text = DOM.userAnswerInput.value.trim();
  if (!text) {
    showToast('Chưa có nội dung để xuất file!');
    return;
  }

  const q = state.currentQuestion;
  const content = `========================================================
OPIC PRACTICE SESSION
Date: ${new Date().toLocaleString()}
Topic: ${q ? q.topic : 'General'} | Target Level: ${q ? q.targetLevel : 'IH-AL'}
========================================================

QUESTION PROMPT:
${q ? q.question : ''}

--------------------------------------------------------
YOUR RESPONSE (${DOM.wordCount.textContent} words):
${text}

--------------------------------------------------------
REFERENCE SAMPLE ANSWER:
${q && q.sampleAnswer ? q.sampleAnswer : 'None'}
========================================================
Generated by OPIC Master (Offline Edition)
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `OPIC_Practice_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('Đã xuất file bài luyện thành công!');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast-box';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ==========================================
// 6. EVENT BINDINGS
// ==========================================
function initEvents() {
  DOM.filterLevel.addEventListener('change', applyFilters);
  DOM.filterTopic.addEventListener('change', applyFilters);
  DOM.searchInput.addEventListener('input', applyFilters);
  DOM.btnRandom.addEventListener('click', selectRandomQuestion);

  DOM.btnPrevQ.addEventListener('click', () => {
    if (state.currentIndex > 0) displayQuestion(state.currentIndex - 1);
  });

  DOM.btnNextQ.addEventListener('click', () => {
    if (state.currentIndex < state.filteredQuestions.length - 1) {
      displayQuestion(state.currentIndex + 1);
    }
  });

  DOM.btnShuffleQ.addEventListener('click', selectRandomQuestion);

  DOM.btnToggleSampleAnswer.addEventListener('click', () => {
    const isHidden = DOM.sampleAnswerContainer.style.display === 'none';
    if (isHidden) {
      DOM.sampleAnswerContainer.style.display = 'block';
      DOM.sampleToggleIcon.innerHTML = '&uarr;';
    } else {
      DOM.sampleAnswerContainer.style.display = 'none';
      DOM.sampleToggleIcon.innerHTML = '&darr;';
    }
  });
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  initVoice();
  initTimer();
  initTextEvents();
  initEvents();
  initData();
});
