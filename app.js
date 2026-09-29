/**
 * OPIC Master - Online Edition
 * Browser-based TTS with English US/UK voice prioritization.
 * Supports Bilingual Question Translation, Dictionary Lookup & Voice Engine.
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
    englishVoices: [],
    selectedVoice: null,
    rate: 1.0,
    isSpeaking: false,
    recognition: null,
    isRecording: false
  },

  history: [],
  translationCache: {},
  dictCache: JSON.parse(localStorage.getItem('opic_dict_cache') || '{}'),
  isQuestionHidden: localStorage.getItem('opic_blind_mode') === 'true',
  currentLookupWord: ''
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

  // Translation
  btnToggleTranslateQ: document.getElementById('btnToggleTranslateQ'),
  qTranslationBox: document.getElementById('qTranslationBox'),
  qTranslationText: document.getElementById('qTranslationText'),
  btnToggleHideQ: document.getElementById('btnToggleHideQ'),
  hideQBtnText: document.getElementById('hideQBtnText'),
  qVisibleContainer: document.getElementById('qVisibleContainer'),
  qHiddenOverlay: document.getElementById('qHiddenOverlay'),
  btnListenBlind: document.getElementById('btnListenBlind'),
  btnRevealQ: document.getElementById('btnRevealQ'),

  // TTS
  ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
  ttsRateSlider: document.getElementById('ttsRateSlider'),
  ttsRateValue: document.getElementById('ttsRateValue'),
  btnTtsPlay: document.getElementById('btnTtsPlay'),
  btnTtsPause: document.getElementById('btnTtsPause'),
  btnTtsStop: document.getElementById('btnTtsStop'),
  ttsStatus: document.getElementById('ttsStatus'),

  // Sample Answer
  btnToggleSampleAnswer: document.getElementById('btnToggleSampleAnswer'),
  sampleToggleIcon: document.getElementById('sampleToggleIcon'),
  sampleAnswerContainer: document.getElementById('sampleAnswerContainer'),
  sampleAnswerText: document.getElementById('sampleAnswerText'),
  btnListenSample: document.getElementById('btnListenSample'),
  btnToggleTranslateSample: document.getElementById('btnToggleTranslateSample'),
  sampleTranslationBox: document.getElementById('sampleTranslationBox'),
  sampleTranslationText: document.getElementById('sampleTranslationText'),

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
  btnClearHistory: document.getElementById('btnClearHistory'),

  // Dictionary Modal
  btnOpenDictionary: document.getElementById('btnOpenDictionary'),
  dictModal: document.getElementById('dictModal'),
  btnCloseDict: document.getElementById('btnCloseDict'),
  dictInput: document.getElementById('dictInput'),
  btnDoLookup: document.getElementById('btnDoLookup'),
  dictEmptyMsg: document.getElementById('dictEmptyMsg'),
  dictResultCard: document.getElementById('dictResultCard'),
  dictWordName: document.getElementById('dictWordName'),
  dictPhoneticIpa: document.getElementById('dictPhoneticIpa'),
  dictVietnameseBrief: document.getElementById('dictVietnameseBrief'),
  btnPlayWordAudio: document.getElementById('btnPlayWordAudio'),
  dictDefinitionsList: document.getElementById('dictDefinitionsList'),

  // Floating selection
  selectionLookupBtn: document.getElementById('selectionLookupBtn'),
  selectionLookupWord: document.getElementById('selectionLookupWord')
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

  // Reset translations
  DOM.qTranslationBox.style.display = 'none';
  DOM.btnToggleTranslateQ.innerHTML = '<span>🌐 Xem dịch tiếng Việt</span>';
  DOM.qTranslationText.textContent = '';

  if (q.sampleAnswer && q.sampleAnswer.trim()) {
    DOM.sampleAnswerText.textContent = q.sampleAnswer.trim();
  } else {
    DOM.sampleAnswerText.textContent = 'Chưa có bài mẫu cho câu hỏi này.';
  }

  DOM.sampleTranslationBox.style.display = 'none';
  DOM.btnToggleTranslateSample.innerHTML = '🌐 Dịch bài mẫu';
  DOM.sampleTranslationText.textContent = '';

    // Maintain Blind Mode state
  if (state.isQuestionHidden && DOM.qVisibleContainer && DOM.qHiddenOverlay) {
    DOM.qVisibleContainer.style.display = 'none';
    DOM.qHiddenOverlay.style.display = 'block';
  } else if (DOM.qVisibleContainer && DOM.qHiddenOverlay) {
    DOM.qVisibleContainer.style.display = 'block';
    DOM.qHiddenOverlay.style.display = 'none';
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
// 2. TRANSLATION ENGINE
// ==========================================
async function translateText(text) {
  if (!text || !text.trim()) return '';
  const clean = text.trim();
  if (state.translationCache[clean]) return state.translationCache[clean];

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const trans = data[0].map(item => item[0]).join('');
        state.translationCache[clean] = trans;
        return trans;
      }
    }
  } catch (e) {}

  return 'Bản dịch tự động yêu cầu kết nối mạng khi tải lần đầu. (Nội dung câu hỏi: ' + clean.slice(0, 50) + '...)';
}

function initTranslation() {
  DOM.btnToggleTranslateQ.addEventListener('click', async () => {
    const isHidden = DOM.qTranslationBox.style.display === 'none';
    if (isHidden) {
      DOM.qTranslationBox.style.display = 'block';
      DOM.btnToggleTranslateQ.innerHTML = '<span>Ẩn dịch tiếng Việt</span>';
      if (!DOM.qTranslationText.textContent || DOM.qTranslationText.textContent === 'Đang tải bản dịch...') {
        DOM.qTranslationText.textContent = 'Đang dịch câu hỏi...';
        const vi = await translateText(state.currentQuestion ? state.currentQuestion.question : '');
        DOM.qTranslationText.textContent = vi;
      }
    } else {
      DOM.qTranslationBox.style.display = 'none';
      DOM.btnToggleTranslateQ.innerHTML = '<span>🌐 Xem dịch tiếng Việt</span>';
    }
  });

  DOM.btnToggleTranslateSample.addEventListener('click', async () => {
    const isHidden = DOM.sampleTranslationBox.style.display === 'none';
    if (isHidden) {
      DOM.sampleTranslationBox.style.display = 'block';
      DOM.btnToggleTranslateSample.innerHTML = 'Ẩn dịch bài mẫu';
      if (!DOM.sampleTranslationText.textContent || DOM.sampleTranslationText.textContent === 'Đang dịch bài mẫu...') {
        DOM.sampleTranslationText.textContent = 'Đang dịch bài mẫu...';
        const vi = await translateText(state.currentQuestion ? state.currentQuestion.sampleAnswer : '');
        DOM.sampleTranslationText.textContent = vi;
      }
    } else {
      DOM.sampleTranslationBox.style.display = 'none';
      DOM.btnToggleTranslateSample.innerHTML = '🌐 Dịch bài mẫu';
    }
  });
}

// ==========================================
const DICT_PRESET_CACHE = {
  "company": {
    "word": "company",
    "phonetic": "/ˈkʌmpəni/",
    "vietnamese": "công ty, doanh nghiệp, sự đồng hành",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A business organization that makes or sells goods or services.", "example": "He works for a multinational technology company." },
          { "definition": "The fact of being with another person or other people.", "example": "I enjoy her company very much." }
        ]
      }
    ]
  },
  "routine": {
    "word": "routine",
    "phonetic": "/ruːˈtiːn/",
    "vietnamese": "thói quen hàng ngày, lịch trình thường lệ",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A standard, regular procedure or habitual practice.", "example": "My morning routine starts at 6:30 AM." }
        ]
      },
      {
        "partOfSpeech": "adjective",
        "definitions": [
          { "definition": "Performed as part of a regular procedure rather than for a special reason.", "example": "This is just a routine medical check-up." }
        ]
      }
    ]
  },
  "experience": {
    "word": "experience",
    "phonetic": "/ɪkˈspɪə.ri.əns/",
    "vietnamese": "kinh nghiệm, trải nghiệm",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "Knowledge or skill acquired by a period of practical experience.", "example": "She has over ten years of experience in project management." },
          { "definition": "An event or occurrence which leaves an impression on someone.", "example": "It was an unforgettable travel experience." }
        ]
      },
      {
        "partOfSpeech": "verb",
        "definitions": [
          { "definition": "Encounter or undergo an event or occurrence.", "example": "The company experienced significant growth last year." }
        ]
      }
    ]
  },
  "describe": {
    "word": "describe",
    "phonetic": "/dɪˈskraɪb/",
    "vietnamese": "miêu tả, thuật lại chi tiết",
    "meanings": [
      {
        "partOfSpeech": "verb",
        "definitions": [
          { "definition": "Give a detailed account in words of someone or something.", "example": "Can you describe your neighborhood to me?" }
        ]
      }
    ]
  },
  "housing": {
    "word": "housing",
    "phonetic": "/ˈhaʊ.zɪŋ/",
    "vietnamese": "nơi ở, nhà cửa, vấn đề nhà ở",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "Houses and apartments considered collectively.", "example": "Affordable housing is important in modern cities." }
        ]
      }
    ]
  },
  "convenient": {
    "word": "convenient",
    "phonetic": "/kənˈviː.ni.ənt/",
    "vietnamese": "tiện lợi, thuận tiện, dễ tiếp cận",
    "meanings": [
      {
        "partOfSpeech": "adjective",
        "definitions": [
          { "definition": "Fitting in well with a person's needs, activities, or plans.", "example": "The apartment is very convenient because it is near the subway station." }
        ]
      }
    ]
  },
  "responsibility": {
    "word": "responsibility",
    "phonetic": "/rɪˌspɒn.sɪˈbɪl.ə.ti/",
    "vietnamese": "trách nhiệm, nhiệm vụ được giao",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A thing which one is required to do as part of a job or legal obligation.", "example": "My main responsibility is training new employees." }
        ]
      }
    ]
  },
  "neighborhood": {
    "word": "neighborhood",
    "phonetic": "/ˈneɪ.bə.hʊd/",
    "vietnamese": "khu phố, vùng lân cận xung quanh",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A district, especially one forming a community within a town or city.", "example": "It is a peaceful and friendly neighborhood." }
        ]
      }
    ]
  },
  "appliance": {
    "word": "appliance",
    "phonetic": "/əˈplaɪ.əns/",
    "vietnamese": "thiết bị, đồ gia dụng gia đình",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A device or piece of equipment designed to perform a specific task, typically a domestic one.", "example": "Modern kitchens are equipped with electrical appliances like microwaves and fridges." }
        ]
      }
    ]
  },
  "atmosphere": {
    "word": "atmosphere",
    "phonetic": "/ˈæt.məs.fɪər/",
    "vietnamese": "bầu không khí, cảm giác không gian",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "The pervading tone or mood of a place, situation, or creative work.", "example": "The coffee shop has a cozy and welcoming atmosphere." }
        ]
      }
    ]
  },
  "vacation": {
    "word": "vacation",
    "phonetic": "/veɪˈkeɪ.ʃən/",
    "vietnamese": "kỳ nghỉ, chuyến du lịch",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "An extended period of recreation, especially one spent away from home or travelling.", "example": "I took a two-week vacation to the beach last summer." }
        ]
      }
    ]
  },
  "colleague": {
    "word": "colleague",
    "phonetic": "/ˈkɒl.iːɡ/",
    "vietnamese": "đồng nghiệp làm việc cùng",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A person with whom one works in a profession or business.", "example": "I often have lunch with my colleagues at work." }
        ]
      }
    ]
  },
  "schedule": {
    "word": "schedule",
    "phonetic": "/ˈʃedʒ.uːl/",
    "vietnamese": "lịch trình, thời gian biểu",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A plan that gives expected times for different events or things to happen.", "example": "I have a tight work schedule this week." }
        ]
      },
      {
        "partOfSpeech": "verb",
        "definitions": [
          { "definition": "Arrange that an event or activity will happen at a particular time.", "example": "The meeting is scheduled for 9 AM tomorrow." }
        ]
      }
    ]
  },
  "commute": {
    "word": "commute",
    "phonetic": "/kəˈmjuːt/",
    "vietnamese": "quãng đường đi làm, việc đi lại giữa nhà và chỗ làm",
    "meanings": [
      {
        "partOfSpeech": "verb",
        "definitions": [
          { "definition": "Travel some distance between one's home and place of work on a regular basis.", "example": "He commutes to work by train every day." }
        ]
      },
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "A regular journey of some distance to and from one's place of work.", "example": "It takes a 45-minute commute to get to my office." }
        ]
      }
    ]
  },
  "leisure": {
    "word": "leisure",
    "phonetic": "/ˈleʒ.ər/",
    "vietnamese": "thời gian rảnh rỗi, nghỉ ngơi thư giãn",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "Time when one is not working or occupied; free time.", "example": "In my leisure time, I enjoy listening to acoustic music." }
        ]
      }
    ]
  },
  "hobby": {
    "word": "hobby",
    "phonetic": "/ˈhɒb.i/",
    "vietnamese": "sở thích cá nhân",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "An activity done regularly in one's leisure time for pleasure.", "example": "Playing football with friends is my favorite hobby." }
        ]
      }
    ]
  },
  "weather": {
    "word": "weather",
    "phonetic": "/ˈweð.ər/",
    "vietnamese": "thời tiết khí hậu",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "The state of the atmosphere at a place and time regarding heat, cloudiness, dryness, sunshine, wind, rain, etc.", "example": "The weather in autumn is cool and pleasant." }
        ]
      }
    ]
  },
  "renovate": {
    "word": "renovate",
    "phonetic": "/ˈren.ə.veɪt/",
    "vietnamese": "cải tạo, sửa chữa, nâng cấp nhà cửa",
    "meanings": [
      {
        "partOfSpeech": "verb",
        "definitions": [
          { "definition": "Restore something old or in disrepair to a good state of repair.", "example": "We plan to renovate our living room next month." }
        ]
      }
    ]
  },
  "memorable": {
    "word": "memorable",
    "phonetic": "/ˈmem.ər.ə.bəl/",
    "vietnamese": "đáng nhớ, không thể nào quên",
    "meanings": [
      {
        "partOfSpeech": "adjective",
        "definitions": [
          { "definition": "Easily remembered, especially because of being special or unusual.", "example": "That family trip was one of the most memorable experiences of my life." }
        ]
      }
    ]
  },
  "celebrate": {
    "word": "celebrate",
    "phonetic": "/ˈsel.ə.breɪt/",
    "vietnamese": "kỷ niệm, ăn mừng, tổ chức tiệc",
    "meanings": [
      {
        "partOfSpeech": "verb",
        "definitions": [
          { "definition": "Acknowledge a significant or happy day or an event with a social gathering or enjoyable activity.", "example": "We gathered at a local restaurant to celebrate his promotion." }
        ]
      }
    ]
  }
};

// 3. DICTIONARY LOOKUP ENGINE
// ==========================================
function initDictionary() {
  DOM.btnOpenDictionary.addEventListener('click', () => openDict());
  DOM.btnCloseDict.addEventListener('click', () => closeDict());
  DOM.dictModal.addEventListener('click', (e) => {
    if (e.target === DOM.dictModal) closeDict();
  });

  DOM.btnDoLookup.addEventListener('click', () => {
    const w = DOM.dictInput.value.trim();
    if (w) lookupWord(w);
  });

  DOM.dictInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const w = DOM.dictInput.value.trim();
      if (w) lookupWord(w);
    }
  });

  DOM.btnPlayWordAudio.addEventListener('click', () => {
    if (state.currentLookupWord) speak(state.currentLookupWord);
  });

  // Selection popup
  document.addEventListener('mouseup', (e) => {
    if (DOM.dictModal.contains(e.target) || DOM.selectionLookupBtn.contains(e.target)) return;
    const sel = window.getSelection();
    const str = sel.toString().trim();
    if (str && str.length >= 2 && str.length <= 30 && !str.includes('\n')) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      DOM.selectionLookupWord.textContent = str.length > 15 ? str.slice(0, 15) + '...' : str;
      DOM.selectionLookupBtn.style.top = `${window.scrollY + rect.top - 36}px`;
      DOM.selectionLookupBtn.style.left = `${window.scrollX + rect.left}px`;
      DOM.selectionLookupBtn.style.display = 'flex';
      DOM.selectionLookupBtn.onclick = () => {
        DOM.selectionLookupBtn.style.display = 'none';
        openDict(str);
      };
    } else {
      DOM.selectionLookupBtn.style.display = 'none';
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!DOM.selectionLookupBtn.contains(e.target)) {
      DOM.selectionLookupBtn.style.display = 'none';
    }
  });
}

function openDict(word = '') {
  DOM.dictModal.style.display = 'flex';
  if (word) {
    DOM.dictInput.value = word;
    lookupWord(word);
  } else {
    DOM.dictInput.focus();
  }
}

function closeDict() {
  DOM.dictModal.style.display = 'none';
}

async function lookupWord(raw) {
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '');
  if (!clean) return;

  state.currentLookupWord = clean;
  DOM.dictEmptyMsg.style.display = 'none';
  DOM.dictResultCard.style.display = 'block';
  DOM.dictWordName.textContent = clean;

  // 1. Instant Cache check (0ms)
  const cached = state.dictCache[clean] || DICT_PRESET_CACHE[clean];
  if (cached) {
    renderOfflineDictEntry(cached);
    return;
  }

  DOM.dictPhoneticIpa.textContent = '/' + clean + '/';
  DOM.dictVietnameseBrief.textContent = 'Đang tra nghĩa siêu tốc...';
  DOM.dictDefinitionsList.innerHTML = '<p style="color: #64748b; font-size: 12px;"><i class="fa-solid fa-bolt"></i> Đang tải dữ liệu từ điển...</p>';

  let dictEntry = null;
  const fetchDict = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(clean), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  };

  const [dictRes, viRes] = await Promise.allSettled([
    fetchDict(),
    translateText(clean)
  ]);

  const dictData = (dictRes.status === 'fulfilled' && dictRes.value) ? dictRes.value[0] : null;
  const vi = (viRes.status === 'fulfilled' && viRes.value) ? viRes.value : clean;

  const entry = {
    word: clean,
    phonetic: (dictData && dictData.phonetic) ? dictData.phonetic : ('/' + clean + '/'),
    vietnamese: vi,
    meanings: (dictData && dictData.meanings) ? dictData.meanings : [
      {
        partOfSpeech: 'word',
        definitions: [{ definition: vi }]
      }
    ]
  };

  state.dictCache[clean] = entry;
  try {
    localStorage.setItem('opic_dict_cache', JSON.stringify(state.dictCache));
  } catch (e) {}

  renderOfflineDictEntry(entry);
}

function renderOfflineDictEntry(entry) {
  DOM.dictWordName.textContent = entry.word;
  DOM.dictPhoneticIpa.textContent = entry.phonetic || ('/' + (entry.word || '') + '/');
  DOM.dictVietnameseBrief.textContent = 'Nghĩa tiếng Việt: ' + entry.vietnamese;
  DOM.dictDefinitionsList.innerHTML = '';

  (entry.meanings || []).forEach(m => {
    const box = document.createElement('div');
    box.style.background = '#f8fafc';
    box.style.border = '1px solid #e2e8f0';
    box.style.borderRadius = '8px';
    box.style.padding = '10px 12px';
    box.style.fontSize = '12px';

    const pos = m.partOfSpeech || 'noun';
    const defs = (m.definitions || []).slice(0, 3).map((d, i) => `
      <div style="margin-top: 4px;">
        <strong style="color: #059669;">${i + 1}.</strong> ${escapeHtml(d.definition)}
        ${d.example ? `<div style="color: #64748b; font-style: italic; padding-left: 10px; margin-top: 2px;">"${escapeHtml(d.example)}"</div>` : ''}
      </div>
    `).join('');

    box.innerHTML = `
      <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
        <span class="pos-badge pos-${pos}">${escapeHtml(pos)}</span>
      </div>
      ${defs}
    `;
    DOM.dictDefinitionsList.appendChild(box);
  });
}

// ==========================================
// 4. VOICE ENGINE (TTS & STT - ONLINE / STANDARD ENGLISH)
// ==========================================
function initVoice() {
  const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  if (hasTTS) {
    const loadVoices = () => {
      state.voice.voices = window.speechSynthesis.getVoices();
      DOM.ttsVoiceSelect.innerHTML = '';

      const enVoices = state.voice.voices.filter(v => /^en(-|_)/i.test(v.lang));
      const usVoices = enVoices.filter(v => /^en(-|_)US/i.test(v.lang));
      const ukVoices = enVoices.filter(v => /^en(-|_)GB/i.test(v.lang));
      const otherVoices = enVoices.filter(v => !/^en(-|_)US|^en(-|_)GB/i.test(v.lang));
      const ordered = [...usVoices, ...ukVoices, ...otherVoices];
      state.voice.englishVoices = ordered;

      if (ordered.length === 0) {
        const opt = document.createElement('option');
        opt.value = 'default';
        opt.textContent = 'English mặc định của thiết bị';
        DOM.ttsVoiceSelect.appendChild(opt);
        DOM.ttsStatus.textContent = '🌐 Online · English mặc định';
        return;
      }

      ordered.forEach((v, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        const region = /^en(-|_)US/i.test(v.lang) ? '🇺🇸 US' : /^en(-|_)GB/i.test(v.lang) ? '🇬🇧 UK' : '🌐 English';
        opt.textContent = `${region} · ${v.name} (${v.lang})`;
        DOM.ttsVoiceSelect.appendChild(opt);
      });

      // Prefer a clear US English voice for OPIC practice.
      const preferred = ordered.findIndex(v =>
        /^en(-|_)US/i.test(v.lang) &&
        /(Google|Microsoft|Natural|Samantha|Alex|Jenny|Aria|Guy|Zira|David)/i.test(v.name)
      );
      const usIndex = ordered.findIndex(v => /^en(-|_)US/i.test(v.lang));
      const defaultIndex = preferred >= 0 ? preferred : (usIndex >= 0 ? usIndex : 0);
      DOM.ttsVoiceSelect.value = String(defaultIndex);
      DOM.ttsStatus.textContent = '🌐 Online · English US';
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  } else {
    DOM.ttsStatus.textContent = '⚠️ Trình duyệt không hỗ trợ đọc giọng nói';
  }

  DOM.ttsRateSlider.addEventListener('input', (e) => {
    state.voice.rate = parseFloat(e.target.value);
    DOM.ttsRateValue.textContent = `${state.voice.rate.toFixed(1)}x`;
  });

  DOM.btnTtsPlay.addEventListener('click', () => {
    if (state.voice.synth.speaking && state.voice.synth.paused) {
      state.voice.synth.resume();
      return;
    }
    if (state.currentQuestion) speak(state.currentQuestion.question);
  });

  DOM.btnTtsPause.addEventListener('click', () => {
    if (state.voice.synth.speaking) state.voice.synth.pause();
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

  // Speech recognition for speaking practice. Chrome Android commonly uses Google Speech Services.
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
      DOM.micBtnText.textContent = '🎙️ Bật Micro (Nói)';
      DOM.speechIndicator.innerHTML = '<span style="color: #059669;">● Sẵn sàng</span>';
    };

    DOM.btnMicToggle.addEventListener('click', () => {
      if (state.voice.isRecording) {
        state.voice.recognition.stop();
      } else {
        try {
          state.voice.recognition.start();
          if (!state.timer.isRunning && state.timer.remaining > 0) startTimer();
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
  if (!('speechSynthesis' in window)) return;

  if (state.isQuestionHidden && DOM.qVisibleContainer && DOM.qHiddenOverlay) {
    DOM.qVisibleContainer.style.display = 'none';
    DOM.qHiddenOverlay.style.display = 'block';
  } else if (DOM.qVisibleContainer && DOM.qHiddenOverlay) {
    DOM.qVisibleContainer.style.display = 'block';
    DOM.qHiddenOverlay.style.display = 'none';
  }

  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.voice.rate;
  utterance.pitch = 1.0;
  utterance.lang = 'en-US';

  const enVoices = state.voice.englishVoices || state.voice.voices.filter(v => /^en(-|_)/i.test(v.lang));
  const idx = DOM.ttsVoiceSelect.value;
  if (idx !== 'default' && enVoices[Number(idx)]) {
    utterance.voice = enVoices[Number(idx)];
    utterance.lang = utterance.voice.lang;
  }

  utterance.onstart = () => {
    DOM.ttsStatus.textContent = '🔊 Đang đọc · English ' + (utterance.lang.toUpperCase());
  };
  utterance.onend = () => {
    DOM.ttsStatus.textContent = '🌐 Online · English US';
  };
  utterance.onerror = () => {
    DOM.ttsStatus.textContent = '⚠️ Không phát được giọng đọc';
  };

  state.voice.synth.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) state.voice.synth.cancel();
  if (DOM.ttsStatus) DOM.ttsStatus.textContent = '🌐 Online · English US';
}

function appendAnswerText(phrase) {
  const cur = DOM.userAnswerInput.value;
  DOM.userAnswerInput.value = cur ? `${cur.trim()} ${phrase} ` : `${phrase} `;
  updateStats();
}

// ==========================================
// 5. TIMER ENGINE
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
// 6. STATS & ANSWER UTILITIES
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
// 7. LOCAL PRACTICE HISTORY (OFFLINE)
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
  if (state.history.length > 30) state.history.pop();
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
// 8. EVENT BINDINGS
// ==========================================
function initBlindMode() {
  const updateBlindUI = (hidden) => {
    state.isQuestionHidden = hidden;
    localStorage.setItem('opic_blind_mode', hidden ? 'true' : 'false');
    if (DOM.qVisibleContainer && DOM.qHiddenOverlay) {
      if (hidden) {
        DOM.qVisibleContainer.style.display = 'none';
        DOM.qHiddenOverlay.style.display = 'block';
        if (DOM.hideQBtnText) DOM.hideQBtnText.textContent = 'đŸ‘ï¸ Hiá»‡n Ä‘á» bĂ i';
      } else {
        DOM.qVisibleContainer.style.display = 'block';
        DOM.qHiddenOverlay.style.display = 'none';
        if (DOM.hideQBtnText) DOM.hideQBtnText.textContent = 'đŸ‘ï¸ áº¨n Ä‘á» bĂ i';
      }
    }
  };

  if (DOM.btnToggleHideQ) {
    DOM.btnToggleHideQ.addEventListener('click', () => {
      updateBlindUI(!state.isQuestionHidden);
    });
  }

  if (DOM.btnRevealQ) {
    DOM.btnRevealQ.addEventListener('click', () => {
      updateBlindUI(false);
    });
  }

  if (DOM.btnListenBlind) {
    DOM.btnListenBlind.addEventListener('click', () => {
      if (state.currentQuestion) speak(state.currentQuestion.question);
    });
  }

  updateBlindUI(state.isQuestionHidden);
}

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
  initTranslation();
  initBlindMode();
  initDictionary();
  initEvents();
  initData();
});
