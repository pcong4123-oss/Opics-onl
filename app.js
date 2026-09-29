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
  if ('speechSynthesis' in window) {
    const loadVoices = () => {
      state.voice.voices = window.speechSynthesis.getVoices();
      DOM.ttsVoiceSelect.innerHTML = '';

      // Prefer REAL US-English browser voices only.
      // We deliberately exclude en-GB/en-AU/etc. so OPIC practice uses an American accent.
      const usVoices = state.voice.voices.filter(v => /^en-US$/i.test(v.lang));

      // Rank common American voices when the browser exposes them.
      const preferred = [
        'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy',
        'Microsoft David', 'Microsoft Zira', 'Samantha', 'Alex',
        'Ava', 'Allison', 'Karen', 'Daniel'
      ];
      usVoices.sort((a, b) => {
        const ai = preferred.findIndex(n => a.name.toLowerCase().includes(n.toLowerCase()));
        const bi = preferred.findIndex(n => b.name.toLowerCase().includes(n.toLowerCase()));
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      });

      if (usVoices.length === 0) {
        DOM.ttsVoiceSelect.innerHTML = '<option value="0">American English (browser default)</option>';
      } else {
        usVoices.forEach((v, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = `${v.name} (English - United States)`;
          DOM.ttsVoiceSelect.appendChild(opt);
        });
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  DOM.ttsRateSlider.addEventListener('input', (e) => {
    state.voice.rate = parseFloat(e.target.value);
    DOM.ttsRateValue.textContent = `${state.voice.rate.toFixed(1)}x`;
  });

  DOM.btnTtsPlay.addEventListener('click', () => {
    if (state.voice.synth.speaking && state.voice.synth.paused) {
      state.voice.synth.resume();
      DOM.btnTtsPlayText.textContent = 'Đang phát âm...';
      return;
    }
    if (state.currentQuestion) {
      speak(state.currentQuestion.question);
    }
  });

  DOM.btnTtsPause.addEventListener('click', () => {
    if (state.voice.synth.speaking) {
      state.voice.synth.pause();
      DOM.btnTtsPlayText.textContent = 'Tiếp tục nghe';
    }
  });

  DOM.btnTtsStop.addEventListener('click', stopSpeech);

  DOM.btnListenSample.addEventListener('click', () => {
    if (state.currentQuestion && state.currentQuestion.sampleAnswer) {
      speak(state.currentQuestion.sampleAnswer);
    }
  });

  DOM.btnListenAnswer.addEventListener('click', () => {
    const text = DOM.userAnswerInput.value.trim();
    if (text) speak(text);
  });

  // Offline STT Recognition
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

    state.voice.recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          const phrase = e.results[i][0].transcript.trim();
          appendAnswerText(phrase);
        }
      }
    };

    state.voice.recognition.onend = () => {
      state.voice.isRecording = false;
      DOM.btnMicToggle.classList.remove('recording');
      DOM.micBtnText.textContent = 'Bật Micro (Nói)';
      DOM.speechIndicator.innerHTML = '<span style="color: #059669;">● Sẵn sàng</span>';
    };

    DOM.btnMicToggle.addEventListener('click', () => {
      if (state.voice.isRecording) {
        state.voice.recognition.stop();
      } else {
        try {
          state.voice.recognition.start();
          if (!state.timer.isRunning && state.timer.remaining > 0) {
            startTimer();
          }
        } catch (err) {
          console.warn('Recognition start error:', err);
        }
      }
    });
  } else {
    DOM.btnMicToggle.style.opacity = '0.6';
    DOM.speechIndicator.textContent = 'Gõ bài làm trực tiếp';
  }
}

function speak(text) {
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.voice.rate;

  // Use only US English voices for American pronunciation.
  const usVoices = state.voice.voices.filter(v => /^en-US$/i.test(v.lang));
  const idx = Number(DOM.ttsVoiceSelect.value);
  if (usVoices[idx]) {
    utterance.voice = usVoices[idx];
    utterance.lang = 'en-US';
  } else {
    // If the device has no en-US voice, still request US English.
    utterance.lang = 'en-US';
  }

  utterance.onstart = () => {
    DOM.btnTtsPlayText.textContent = 'Đang phát âm...';
    DOM.ttsStatus.textContent = '🔊 Đang đọc...';
  };

  utterance.onend = () => {
    DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
    DOM.ttsStatus.textContent = 'American English (en-US)';
  };

  utterance.onerror = () => {
    DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
    DOM.ttsStatus.textContent = 'American English (en-US)';
  };

  state.voice.synth.speak(utterance);
}

function stopSpeech() {
  state.voice.synth.cancel();
  DOM.btnTtsPlayText.textContent = 'Nghe đề bài';
  DOM.ttsStatus.textContent = 'American English (en-US)';
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
