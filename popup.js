document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Popup loaded!");

  // --- DOM Elements (Mapped to popup.html) ---
  const uiLanguageSelect = document.getElementById('ui-language-select');

  // Settings Tab
  const languageSelect = document.getElementById('language-select');
  const personaSelect = document.getElementById('persona-select');
  const customPersonaGroup = document.getElementById('custom-persona-group');
  const customPersonaInput = document.getElementById('custom-persona-input');
  const memoryInput = document.getElementById('memory-input');
  const autoReplyToggle = document.getElementById('auto-reply-toggle');

  // Automation Section
  const toneSelect = document.getElementById('tone-select');
  const replyLengthSelect = document.getElementById('reply-length-select');
  const autoGenerateToggle = document.getElementById('auto-generate-toggle');
  const autoCommentToggle = document.getElementById('auto-comment-toggle');
  const autoLikeToggle = document.getElementById('auto-like-toggle');
  const includeMentionToggle = document.getElementById('include-mention-toggle');
  const actionDelayInput = document.getElementById('action-delay-input');

  // Footer
  const saveButton = document.getElementById('save-settings');
  const clearHistoryButton = document.getElementById('clear-history');

  // --- State Management ---
  let currentUILanguage = 'en';

  // --- UI Logic ---

  // Show/Hide custom persona input
  if (personaSelect) {
    personaSelect.addEventListener('change', () => {
      customPersonaGroup.style.display = (personaSelect.value === 'Custom') ? 'block' : 'none';
    });
  }

  // Load UI Language
  chrome.storage.sync.get(['uiLanguage'], (data) => {
    if (data.uiLanguage) {
      currentUILanguage = data.uiLanguage;
      if (uiLanguageSelect) uiLanguageSelect.value = data.uiLanguage;
    }
    updateUILanguage();
  });

  if (uiLanguageSelect) {
    uiLanguageSelect.addEventListener('change', () => {
      currentUILanguage = uiLanguageSelect.value;
      chrome.storage.sync.set({ uiLanguage: currentUILanguage }, updateUILanguage);
    });
  }

  // Localization Helper
  const getMsg = (key) => {
    const translations = {
      en: {
        popup_title: "X Crypto Agent",
        popup_subtitle: "AI-Powered Assistant",
        popup_save_button: "Save Settings",
        popup_saved: "Saved!",
        popup_clear_history: "Clear History",
        popup_cleared: "Cleared!",
        create_btn: "✨ Generate Post",
        create_generating: "Generating...",
        schedule_btn: "📅 Schedule",
        bulk_save_btn: "Save URLs",
        bulk_start_btn: "Start Process",
        bulk_clear_btn: "Clear List",
        analyze_btn: "Analyze",
        analyzing_btn: "Analyzing...",
        suggest_btn: "Suggest",
        suggesting_btn: "Suggesting...",
        copy: "Copy",
        copied: "Copied",
        schedule_delete_btn: "Delete",
        bulk_no_urls: "No URLs saved",
        schedule_empty: "No scheduled posts",
        style_error: "Error: ",
        unknown_error: "Unknown error",
        hashtag_error: "Failed to suggest hashtags",
        popup_clear_confirm: "Are you sure you want to clear all reply history?"
      },
      tr: {
        popup_title: "X Kripto Ajanı",
        popup_subtitle: "Yapay Zeka Asistanı",
        popup_save_button: "Ayarları Kaydet",
        popup_saved: "Kaydedildi!",
        popup_clear_history: "Geçmişi Temizle",
        popup_cleared: "Temizlendi!",
        create_btn: "✨ Post Oluştur",
        create_generating: "Oluşturuluyor...",
        schedule_btn: "📅 Zamanla",
        bulk_save_btn: "URL'leri Kaydet",
        bulk_start_btn: "Başlat",
        bulk_clear_btn: "Temizle",
        analyze_btn: "Analiz Et",
        analyzing_btn: "Analiz Ediliyor...",
        suggest_btn: "Öner",
        suggesting_btn: "Öneriliyor...",
        copy: "Kopyala",
        copied: "Kopyalandı",
        schedule_delete_btn: "Sil",
        bulk_no_urls: "Kayıtlı URL yok",
        schedule_empty: "Zamanlanmış post yok",
        style_error: "Hata: ",
        unknown_error: "Bilinmeyen hata",
        hashtag_error: "Hashtag önerilemedi",
        popup_clear_confirm: "Tüm yanıt geçmişini silmek istediğinize emin misiniz?"
      }
      // Add other languages as needed, falling back to EN for now
    };

    const lang = translations[currentUILanguage] || translations['en'];
    return lang[key] || translations['en'][key] || key;
  };

  function updateUILanguage() {
    // Update static text elements if needed
    // For buttons, we update them directly
    if (saveButton) saveButton.textContent = getMsg("popup_save_button");
    if (clearHistoryButton) clearHistoryButton.textContent = getMsg("popup_clear_history");

    const createBtn = document.getElementById('generate-post-btn');
    if (createBtn) createBtn.textContent = getMsg("create_btn");

    const scheduleBtn = document.getElementById('schedule-btn');
    if (scheduleBtn) scheduleBtn.textContent = getMsg("schedule_btn");

    const bulkSaveBtn = document.getElementById('bulk-save-btn');
    if (bulkSaveBtn) bulkSaveBtn.textContent = getMsg("bulk_save_btn");

    const bulkStartBtn = document.getElementById('bulk-start-btn');
    if (bulkStartBtn) bulkStartBtn.textContent = getMsg("bulk_start_btn");

    const bulkClearBtn = document.getElementById('bulk-clear-btn');
    if (bulkClearBtn) bulkClearBtn.textContent = getMsg("bulk_clear_btn");

    // Refresh lists to update empty states
    loadSavedUrls();
    loadScheduledPosts();
  }

  // --- Tab Switching ---
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.style.display = 'none');

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.style.display = 'block';
    });
  });

  // --- Settings Logic ---
  chrome.storage.sync.get([
    'selectedLanguage', 'selectedPersona', 'customPersonaPrompt', 'userMemory',
    'autoReplyEnabled', 'tone', 'replyLength', 'autoGenerate',
    'autoComment', 'autoLike', 'actionDelay', 'includeMention'
  ], (data) => {
    if (languageSelect && data.selectedLanguage) languageSelect.value = data.selectedLanguage;
    if (personaSelect && data.selectedPersona) {
      personaSelect.value = data.selectedPersona;
      if (data.selectedPersona === 'Custom' && customPersonaGroup) customPersonaGroup.style.display = 'block';
    }
    if (customPersonaInput && data.customPersonaPrompt) customPersonaInput.value = data.customPersonaPrompt;
    if (memoryInput && data.userMemory) memoryInput.value = data.userMemory;
    if (autoReplyToggle && data.autoReplyEnabled !== undefined) autoReplyToggle.checked = data.autoReplyEnabled;

    if (toneSelect && data.tone) toneSelect.value = data.tone;
    if (replyLengthSelect && data.replyLength) replyLengthSelect.value = data.replyLength;
    if (autoGenerateToggle && data.autoGenerate !== undefined) autoGenerateToggle.checked = data.autoGenerate;
    if (autoCommentToggle && data.autoComment !== undefined) autoCommentToggle.checked = data.autoComment;
    if (autoLikeToggle && data.autoLike !== undefined) autoLikeToggle.checked = data.autoLike;
    if (includeMentionToggle && data.includeMention !== undefined) includeMentionToggle.checked = data.includeMention;
    if (actionDelayInput) actionDelayInput.value = data.actionDelay || 10;
  });

  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const settings = {
        selectedLanguage: languageSelect?.value,
        selectedPersona: personaSelect?.value,
        customPersonaPrompt: customPersonaInput?.value,
        userMemory: memoryInput?.value,
        autoReplyEnabled: autoReplyToggle?.checked,
        tone: toneSelect?.value,
        replyLength: replyLengthSelect?.value,
        autoGenerate: autoGenerateToggle?.checked,
        autoComment: autoCommentToggle?.checked,
        autoLike: autoLikeToggle?.checked,
        includeMention: includeMentionToggle?.checked,
        actionDelay: parseInt(actionDelayInput?.value) || 10
      };

      // Minimum delay of 5 seconds
      if (settings.actionDelay < 5) {
        settings.actionDelay = 5;
      }

      chrome.storage.sync.set(settings, () => {
        const originalText = saveButton.textContent;
        saveButton.textContent = getMsg("popup_saved");
        setTimeout(() => saveButton.textContent = originalText, 1500);
      });
    });
  }

  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', () => {
      if (confirm(getMsg("popup_clear_confirm"))) {
        chrome.storage.local.set({ repliedAuthors: [], replyCount: 0 }, () => {
          const originalText = clearHistoryButton.textContent;
          clearHistoryButton.textContent = getMsg("popup_cleared");
          setTimeout(() => clearHistoryButton.textContent = originalText, 1500);
          loadStats();
        });
      }
    });
  }

  // --- Feature: Project Post Generator ---
  const generatePostBtn = document.getElementById('generate-post-btn');
  if (generatePostBtn) {
    generatePostBtn.addEventListener('click', () => {
      const name = document.getElementById('project-name')?.value?.trim();
      const info = document.getElementById('project-info')?.value?.trim() || '';
      const style = document.getElementById('post-style')?.value || 'Hype';

      if (!name) {
        alert('Please enter project name');
        return;
      }

      generatePostBtn.disabled = true;
      generatePostBtn.textContent = getMsg("create_generating");

      chrome.runtime.sendMessage({
        action: "generateProjectPost",
        projectName: name,
        projectInfo: info,
        postStyle: style
      }, (response) => {
        generatePostBtn.disabled = false;
        generatePostBtn.textContent = getMsg("create_btn");

        const container = document.getElementById('generated-posts-container');
        if (response && response.posts) {
          container.innerHTML = '';
          response.posts.forEach((post, i) => {
            const div = document.createElement('div');
            div.className = 'feature-item';
            div.style.marginBottom = '10px';
            div.innerHTML = `
              <div style="font-weight:bold; color:var(--accent-primary); margin-bottom:4px;">Option ${i + 1}</div>
              <div style="white-space:pre-wrap; margin-bottom:8px;">${post}</div>
              <button class="btn btn-secondary" style="padding:4px 12px; font-size:12px;">${getMsg("copy")}</button>
            `;
            div.querySelector('button').onclick = function () {
              navigator.clipboard.writeText(post);
              this.textContent = getMsg("copied");
              setTimeout(() => this.textContent = getMsg("copy"), 2000);
            };
            container.appendChild(div);
          });

          if (response.imagePrompt) {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'feature-item';
            imgDiv.style.marginTop = '10px';
            imgDiv.style.border = '1px solid var(--accent-purple)';
            imgDiv.innerHTML = `
              <div style="font-weight:bold; color:var(--accent-purple); margin-bottom:4px;">AI Image Prompt</div>
              <div style="white-space:pre-wrap; margin-bottom:8px; font-style:italic;">${response.imagePrompt}</div>
              <button class="btn btn-secondary" style="padding:4px 12px; font-size:12px;">${getMsg("copy")}</button>
            `;
            imgDiv.querySelector('button').onclick = function () {
              navigator.clipboard.writeText(response.imagePrompt);
              this.textContent = getMsg("copied");
              setTimeout(() => this.textContent = getMsg("copy"), 2000);
            };
            container.appendChild(imgDiv);
          }
        } else {
          alert('Error: ' + (response?.error || 'Unknown'));
        }
      });
    });
  }

  // --- Feature: Schedule Post ---
  const scheduleBtn = document.getElementById('schedule-btn');
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', () => {
      const text = document.getElementById('schedule-text')?.value?.trim();
      const timeVal = document.getElementById('schedule-time')?.value;

      if (!text || !timeVal) {
        alert('Please enter text and time');
        return;
      }

      const scheduledTime = new Date(timeVal).getTime();
      if (scheduledTime < Date.now()) {
        alert('Cannot schedule in the past');
        return;
      }

      chrome.storage.local.get({ scheduledPosts: [] }, (data) => {
        const posts = data.scheduledPosts || [];
        posts.push({ text, scheduledTime, id: Date.now() });
        chrome.storage.local.set({ scheduledPosts: posts }, () => {
          chrome.runtime.sendMessage({ action: 'schedulePost', post: { text, scheduledTime } });
          document.getElementById('schedule-text').value = '';
          document.getElementById('schedule-time').value = '';
          loadScheduledPosts();
          alert('Post scheduled!');
        });
      });
    });
  }

  function loadScheduledPosts() {
    const list = document.getElementById('scheduled-posts-list');
    if (!list) return;

    chrome.storage.local.get({ scheduledPosts: [] }, (data) => {
      const posts = data.scheduledPosts || [];
      if (posts.length === 0) {
        list.textContent = getMsg("schedule_empty");
        return;
      }
      list.innerHTML = '';
      posts.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'feature-item';
        div.style.marginBottom = '8px';
        div.innerHTML = `
          <div style="font-size:11px; color:var(--accent-primary);">${new Date(p.scheduledTime).toLocaleString()}</div>
          <div style="margin:4px 0;">${p.text.substring(0, 50)}...</div>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:10px; width:auto;">${getMsg("schedule_delete_btn")}</button>
        `;
        div.querySelector('button').onclick = () => {
          posts.splice(i, 1);
          chrome.storage.local.set({ scheduledPosts: posts }, loadScheduledPosts);
        };
        list.appendChild(div);
      });
    });
  }

  // --- Feature: Bulk Auto Comment ---
  const bulkSaveBtn = document.getElementById('bulk-save-btn');
  const bulkStartBtn = document.getElementById('bulk-start-btn');
  const bulkStopBtn = document.getElementById('bulk-stop-btn');
  const bulkClearBtn = document.getElementById('bulk-clear-btn');
  const bulkUrlsInput = document.getElementById('bulk-urls');
  const bulkList = document.getElementById('bulk-url-list');
  const bulkProgress = document.getElementById('bulk-progress');

  function loadSavedUrls() {
    if (!bulkList) return;
    chrome.storage.local.get({ bulkUrls: [], bulkQueue: [], bulkIndex: 0 }, (data) => {
      const urls = data.bulkUrls || [];
      const queue = data.bulkQueue || [];
      const index = data.bulkIndex || 0;

      if (urls.length === 0) {
        bulkList.textContent = getMsg("bulk_no_urls");
      } else {
        bulkList.innerHTML = urls.map((url, i) =>
          `<div style="padding:4px 0; border-bottom:1px solid var(--border-color); font-size:12px;">${i + 1}. ${url.substring(0, 40)}...</div>`
        ).join('');
      }

      // Show/hide stop button and progress based on queue state
      if (queue.length > 0 && index < queue.length) {
        // Process is running
        if (bulkStartBtn) bulkStartBtn.style.display = 'none';
        if (bulkStopBtn) bulkStopBtn.style.display = 'inline-block';
        if (bulkProgress) bulkProgress.textContent = `Progress: ${index}/${queue.length} completed`;
      } else {
        // Process not running
        if (bulkStartBtn) bulkStartBtn.style.display = 'inline-block';
        if (bulkStopBtn) bulkStopBtn.style.display = 'none';
        if (bulkProgress) bulkProgress.textContent = queue.length > 0 ? `Completed: ${index}/${queue.length}` : '';
      }
    });
  }

  if (bulkSaveBtn) {
    bulkSaveBtn.addEventListener('click', () => {
      const text = bulkUrlsInput?.value?.trim();
      if (!text) return;
      const urls = text.split('\n').map(u => u.trim()).filter(u => u.includes('x.com') || u.includes('twitter.com'));
      if (urls.length === 0) {
        alert('No valid URLs found');
        return;
      }
      chrome.storage.local.set({ bulkUrls: urls }, () => {
        bulkUrlsInput.value = '';
        loadSavedUrls();
        alert(`Saved ${urls.length} URLs`);
      });
    });
  }

  if (bulkStartBtn) {
    bulkStartBtn.addEventListener('click', async () => {
      const data = await chrome.storage.local.get({ bulkUrls: [] });
      if (!data.bulkUrls || data.bulkUrls.length === 0) {
        alert('No URLs to process');
        return;
      }

      // Check if Auto Comment is enabled - required for bulk process
      const settings = await chrome.storage.sync.get({ autoComment: false });
      if (!settings.autoComment) {
        const enableAutoComment = confirm(
          'Auto Comment must be enabled for bulk process to work.\n\n' +
          'Do you want to enable Auto Comment now?'
        );
        if (enableAutoComment) {
          chrome.storage.sync.set({ autoComment: true });
          if (autoCommentToggle) autoCommentToggle.checked = true;
        } else {
          return;
        }
      }

      if (confirm(`Start processing ${data.bulkUrls.length} tweets?\n\nMake sure Auto Comment is ON in the Reply tab.`)) {
        chrome.runtime.sendMessage({ action: 'startBulkProcess', urls: data.bulkUrls });
        bulkStartBtn.style.display = 'none';
        if (bulkStopBtn) bulkStopBtn.style.display = 'inline-block';
        if (bulkProgress) bulkProgress.textContent = 'Starting...';
      }
    });
  }

  if (bulkStopBtn) {
    bulkStopBtn.addEventListener('click', async () => {
      if (confirm('Stop bulk process?')) {
        chrome.runtime.sendMessage({ action: 'stopBulkProcess' });
        bulkStopBtn.style.display = 'none';
        if (bulkStartBtn) bulkStartBtn.style.display = 'inline-block';
        if (bulkProgress) bulkProgress.textContent = 'Stopped';
      }
    });
  }

  // Refresh progress periodically when popup is open
  setInterval(() => {
    loadSavedUrls();
  }, 3000);

  if (bulkClearBtn) {
    bulkClearBtn.addEventListener('click', () => {
      if (confirm('Clear all URLs?')) {
        chrome.storage.local.set({
          bulkUrls: [],
          bulkQueue: [],
          bulkIndex: 0,
          bulkResults: [],
          bulkStopped: true
        }, () => {
          // Also clear the alarm
          chrome.alarms.clear("processBulkQueue");
          loadSavedUrls();
        });
      }
    });
  }

  // --- Feature: Competitor Analysis ---
  const analyzeCompBtn = document.getElementById('analyze-competitor-btn');
  if (analyzeCompBtn) {
    analyzeCompBtn.addEventListener('click', () => {
      const username = document.getElementById('competitor-username')?.value?.trim().replace('@', '');
      if (!username) return;

      analyzeCompBtn.disabled = true;
      analyzeCompBtn.textContent = getMsg("analyzing_btn");

      chrome.runtime.sendMessage({ action: 'analyzeCompetitor', username }, (response) => {
        analyzeCompBtn.disabled = false;
        analyzeCompBtn.textContent = getMsg("analyze_btn");

        const resultDiv = document.getElementById('competitor-analysis-result');
        if (resultDiv) {
          resultDiv.innerHTML = response.success ? response.analysis : ('Error: ' + response.error);
          resultDiv.style.padding = '10px';
          resultDiv.style.background = 'var(--bg-primary)';
          resultDiv.style.marginTop = '10px';
          resultDiv.style.borderRadius = '8px';
        }
      });
    });
  }

  // --- Feature: Hashtag Suggester ---
  const suggestHashBtn = document.getElementById('suggest-hashtags-btn');
  if (suggestHashBtn) {
    suggestHashBtn.addEventListener('click', () => {
      const topic = document.getElementById('hashtag-topic')?.value?.trim();
      if (!topic) return;

      suggestHashBtn.disabled = true;
      suggestHashBtn.textContent = getMsg("suggesting_btn");

      chrome.runtime.sendMessage({ action: 'suggestHashtags', topic }, (response) => {
        suggestHashBtn.disabled = false;
        suggestHashBtn.textContent = getMsg("suggest_btn");

        const resultDiv = document.getElementById('hashtag-results');
        if (resultDiv) {
          if (response.hashtags) {
            resultDiv.innerHTML = response.hashtags.map(tag =>
              `<span style="display:inline-block; margin:2px; padding:4px 8px; background:rgba(29,155,240,0.2); color:var(--accent-primary); border-radius:12px; font-size:12px; cursor:pointer;">${tag}</span>`
            ).join('');
            // Add click to copy
            resultDiv.querySelectorAll('span').forEach(span => {
              span.onclick = () => {
                navigator.clipboard.writeText(span.textContent);
                // Visual feedback could be added here
              };
            });
          } else {
            resultDiv.textContent = getMsg("hashtag_error");
          }
        }
      });
    });
  }

  // --- Feature: Style Analysis ---
  const analyzeStyleBtn = document.getElementById('analyze-style-btn');
  if (analyzeStyleBtn) {
    analyzeStyleBtn.addEventListener('click', () => {
      const username = document.getElementById('twitter-username-input')?.value?.trim().replace('@', '');
      if (!username) return;

      analyzeStyleBtn.disabled = true;
      analyzeStyleBtn.textContent = getMsg("analyzing_btn");

      chrome.runtime.sendMessage({ action: 'analyzeMyStyle', username }, (response) => {
        analyzeStyleBtn.disabled = false;
        analyzeStyleBtn.textContent = getMsg("analyze_btn");

        const display = document.getElementById('my-writing-style-display');
        if (display) {
          display.textContent = response.success ? response.style : ('Error: ' + response.error);
          if (response.success) {
            chrome.storage.sync.set({ myWritingStyle: response.style });
          }
        }
      });
    });
  }

  // --- Feature: Viral Hooks ---
  const viralBtn = document.getElementById('generate-viral-btn');
  if (viralBtn) {
    viralBtn.addEventListener('click', () => {
      const topic = document.getElementById('viral-topic')?.value?.trim();
      if (!topic) return;

      viralBtn.disabled = true;
      viralBtn.textContent = getMsg("create_generating");

      // Mock viral generation for now or use a real endpoint if available
      // Using generateProjectPost as a proxy for now with specific style
      chrome.runtime.sendMessage({
        action: "generateProjectPost",
        projectName: topic,
        projectInfo: "Create viral hooks for this topic",
        postStyle: "Viral Hooks"
      }, (response) => {
        viralBtn.disabled = false;
        viralBtn.textContent = "🚀 Generate Viral Hooks";

        const container = document.getElementById('viral-posts-container');
        if (response && response.posts) {
          container.innerHTML = response.posts.map(post => `
             <div class="feature-item" style="margin-bottom:8px;">
               <div>${post}</div>
               <button class="btn btn-secondary" style="padding:2px 8px; font-size:10px; margin-top:4px;" onclick="navigator.clipboard.writeText('${post.replace(/'/g, "\\'")}')">Copy</button>
             </div>
           `).join('');
        }
      });
    });
  }

  // --- Feature: Targeting Save ---
  const saveTargetingBtn = document.getElementById('save-targeting-btn');
  if (saveTargetingBtn) {
    // Load existing targeting settings
    chrome.storage.sync.get(['dailyLimit', 'minFollowers', 'maxFollowers', 'nicheKeywords', 'blacklist', 'whitelist'], (data) => {
      if (data.dailyLimit) document.getElementById('daily-limit').value = data.dailyLimit;
      if (data.minFollowers) document.getElementById('min-followers').value = data.minFollowers;
      if (data.maxFollowers !== undefined) document.getElementById('max-followers').value = data.maxFollowers;
      if (data.nicheKeywords) document.getElementById('niche-keywords').value = data.nicheKeywords;
      if (data.blacklist) document.getElementById('blacklist-users').value = data.blacklist;
    });

    saveTargetingBtn.addEventListener('click', () => {
      const settings = {
        minFollowers: parseInt(document.getElementById('min-followers')?.value) || 0,
        maxFollowers: parseInt(document.getElementById('max-followers')?.value) || 0,
        nicheKeywords: document.getElementById('niche-keywords')?.value || '',
        blacklist: document.getElementById('blacklist-users')?.value || ''
      };
      chrome.storage.sync.set(settings, () => {
        alert('Targeting settings saved!');
      });
    });
  }

  // --- Stats ---
  function loadStats() {
    chrome.storage.local.get({ repliedAuthors: [], replyCount: 0 }, (data) => {
      const authors = new Set(data.repliedAuthors.map(a => (typeof a === 'string' ? a : a.username).toLowerCase()));
      document.getElementById('stat-replies').textContent = data.replyCount || 0;
      document.getElementById('stat-authors').textContent = authors.size || 0;
    });
  }
  loadStats();

});
