/**
 * 音声入力SOAPノート - メインアプリケーション制御
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM要素の取得
  const btnStartRecord = document.getElementById('btnStartRecord');
  const btnStopRecord = document.getElementById('btnStopRecord');
  const btnConvertSoap = document.getElementById('btnConvertSoap');
  const btnClear = document.getElementById('btnClear');
  const btnLoadSample = document.getElementById('btnLoadSample');
  const btnCopyAll = document.getElementById('btnCopyAll');
  const btnExportTxt = document.getElementById('btnExportTxt');

  const rawTextInput = document.getElementById('rawTextInput');
  const interimTranscript = document.getElementById('interimTranscript');
  const liveVoiceWave = document.getElementById('liveVoiceWave');
  const recordingStatusBadge = document.getElementById('recordingStatusBadge');
  const statusText = document.getElementById('statusText');
  const browserWarning = document.getElementById('browserWarning');
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');
  const charCount = document.getElementById('charCount');
  const totalSentenceCount = document.getElementById('totalSentenceCount');
  const toastNotification = document.getElementById('toastNotification');

  // SOAPカード要素
  const cardElements = {
    s: { list: document.getElementById('list-s'), count: document.getElementById('count-s') },
    o: { list: document.getElementById('list-o'), count: document.getElementById('count-o') },
    a: { list: document.getElementById('list-a'), count: document.getElementById('count-a') },
    p: { list: document.getElementById('list-p'), count: document.getElementById('count-p') },
    unclassified: { list: document.getElementById('list-unclassified'), count: document.getElementById('count-unclassified') }
  };

  // サンプルデータセット
  const SAMPLE_TEXT = 
`右膝の内側がズキズキ痛いと訴えがある。
夜間も痛みで眠れない日があり、今後の生活に強い不安を感じている。
膝関節ROMは屈曲110度、伸展-10度であり、軽度の熱感と腫脹を認める。
大腿四頭筋MMTは右3、左4レベル、歩行速度は通常より低下している。
疼痛と関節可動域制限による歩行能力の低下が主な問題点と考えられる。
下肢筋力低下に伴い、階段昇降時の転倒リスクが高いと評価した。
明日より温熱療法と大腿四頭筋セッティングプログラムを実施する。
週3回の自主トレ指導を継続し、来月の自宅退院を目標とする。
本日はご家族の方も同席されました。`;

  // 音声認識マネージャーの初期化
  const speechManager = new SpeechRecognitionManager();

  // ブラウザ対応状況の確認
  if (!speechManager.isSupported()) {
    browserWarning.classList.remove('hidden');
    btnStartRecord.disabled = true;
    btnStartRecord.title = 'お使いのブラウザはWeb Speech APIに対応していません';
  }

  // 文字数カウントの更新
  function updateCharCount() {
    const len = rawTextInput.value.length;
    charCount.textContent = `文字数: ${len}`;
  }

  rawTextInput.addEventListener('input', updateCharCount);

  // トースト表示ヘルパー
  let toastTimer = null;
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastNotification.textContent = message;
    toastNotification.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 2800);
  }

  // エラー表示ヘルパー
  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.classList.remove('hidden');
  }

  function hideError() {
    errorAlert.classList.add('hidden');
  }

  // 録音UI状態の更新
  function updateRecordingUi(state) {
    if (state === 'recording') {
      btnStartRecord.disabled = true;
      btnStopRecord.disabled = false;
      liveVoiceWave.classList.remove('hidden');
      recordingStatusBadge.className = 'status-badge status-recording';
      statusText.textContent = '録音中...';
    } else {
      btnStartRecord.disabled = false;
      btnStopRecord.disabled = true;
      liveVoiceWave.classList.add('hidden');
      interimTranscript.classList.add('hidden');
      recordingStatusBadge.className = 'status-badge status-idle';
      statusText.textContent = '待機中';
    }
  }

  // 1. 録音開始ボタン押下
  btnStartRecord.addEventListener('click', () => {
    hideError();

    // 既存テキストがある場合はそれを引き継ぐ
    const currentText = rawTextInput.value.trim();

    const success = speechManager.start(currentText, {
      onInterim: (interim, full) => {
        // 暫定認識テキストのリアルタイムオーバーレイ表示
        if (interim) {
          interimTranscript.textContent = `🎤 ${interim}`;
          interimTranscript.classList.remove('hidden');
        } else {
          interimTranscript.classList.add('hidden');
        }
      },
      onFinal: (finalText) => {
        // 確定したテキストをリアルタイムでテキストエリアに反映
        rawTextInput.value = finalText;
        updateCharCount();
        rawTextInput.scrollTop = rawTextInput.scrollHeight;
      },
      onStatusChange: (status) => {
        updateRecordingUi(status);
      },
      onError: (errMessage) => {
        showError(errMessage);
        updateRecordingUi('idle');
      }
    });

    if (success) {
      updateRecordingUi('recording');
    }
  });

  // 4. 録音停止ボタン押下
  btnStopRecord.addEventListener('click', () => {
    speechManager.stop();
    updateRecordingUi('idle');

    // 確定テキストを反映
    const fullText = speechManager.getText();
    if (fullText) {
      rawTextInput.value = fullText;
      updateCharCount();
    }
  });

  // クリアボタン
  btnClear.addEventListener('click', () => {
    if (speechManager.isListening) {
      speechManager.stop();
    }
    rawTextInput.value = '';
    speechManager.setText('');
    interimTranscript.textContent = '';
    interimTranscript.classList.add('hidden');
    updateCharCount();
    clearSoapCards();
    hideError();
  });

  // サンプル文章の読み込み
  btnLoadSample.addEventListener('click', () => {
    if (speechManager.isListening) {
      speechManager.stop();
    }
    rawTextInput.value = SAMPLE_TEXT.trim();
    speechManager.setText(SAMPLE_TEXT.trim());
    updateCharCount();
    hideError();
    // 自動でSOAP変換も実行
    executeSoapConversion();
    showToast('サンプル文章を読み込み、SOAP変換を行いました');
  });

  // SOAPカードのリセット表示
  function clearSoapCards() {
    ['s', 'o', 'a', 'p', 'unclassified'].forEach(cat => {
      cardElements[cat].list.innerHTML = '<div class="empty-state">該当する情報はありません</div>';
      cardElements[cat].count.textContent = '0 件';
    });
    totalSentenceCount.textContent = '全 0 文';
  }

  // 5. SOAP変換の実行
  function executeSoapConversion() {
    const text = rawTextInput.value.trim();
    if (!text) {
      showError('振り分ける文章がありません。音声を録音するかテキストを入力してください。');
      return;
    }
    hideError();

    const classification = SoapClassifier.classifySoapText(text);

    // 各カードに結果をレンダリング
    renderCategory('s', classification.categories.s);
    renderCategory('o', classification.categories.o);
    renderCategory('a', classification.categories.a);
    renderCategory('p', classification.categories.p);
    renderCategory('unclassified', classification.categories.unclassified);

    totalSentenceCount.textContent = `全 ${classification.sentences.length} 文`;

    // 画面が小さい場合に結果セクションへスムーズスクロール
    if (window.innerWidth <= 768) {
      document.querySelector('.soap-results-section').scrollIntoView({ behavior: 'smooth' });
    }
  }

  // カテゴリごとのDOM描画
  function renderCategory(catKey, items) {
    const container = cardElements[catKey].list;
    const countBadge = cardElements[catKey].count;

    countBadge.textContent = `${items.length} 件`;

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">該当する情報はありません</div>';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'soap-item-list';

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'soap-item';
      
      const textDiv = document.createElement('div');
      textDiv.className = 'soap-item-text';
      textDiv.innerHTML = item.html;
      li.appendChild(textDiv);

      if (item.keywords && item.keywords.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'soap-item-tags';
        item.keywords.forEach(kw => {
          const tag = document.createElement('span');
          tag.className = 'soap-kw-tag';
          tag.textContent = kw;
          tagsDiv.appendChild(tag);
        });
        li.appendChild(tagsDiv);
      }

      ul.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(ul);
  }

  // SOAP変換ボタンのクリックイベント
  btnConvertSoap.addEventListener('click', () => {
    executeSoapConversion();
  });

  // 各カードの個別コピーボタン
  document.querySelectorAll('.btn-copy-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const card = document.getElementById(`card-${target}`);
      const items = card.querySelectorAll('.soap-item');

      if (items.length === 0) {
        showToast('コピーする内容がありません');
        return;
      }

      const title = card.querySelector('.soap-name').textContent;
      const textList = Array.from(items).map(item => {
        const textElem = item.querySelector('.soap-item-text');
        return '・' + (textElem ? textElem.textContent.trim() : item.textContent.trim());
      }).join('\n');
      const textToCopy = `【${title}】\n${textList}`;

      copyToClipboard(textToCopy, `${title.split('（')[0]} をコピーしました`);
    });
  });

  // 全体コピーボタン
  btnCopyAll.addEventListener('click', () => {
    const text = rawTextInput.value.trim();
    if (!text) {
      showToast('コピーする内容がありません');
      return;
    }

    const classification = SoapClassifier.classifySoapText(text);
    const formatted = SoapClassifier.formatSoapAsText(classification);
    copyToClipboard(formatted, 'SOAP形式全文をコピーしました');
  });

  // テキストファイルとして保存（書き出し）
  btnExportTxt.addEventListener('click', () => {
    const text = rawTextInput.value.trim();
    if (!text) {
      showToast('保存する内容がありません');
      return;
    }

    const classification = SoapClassifier.classifySoapText(text);
    const formatted = SoapClassifier.formatSoapAsText(classification);
    
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    a.href = url;
    a.download = `SOAPノート_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('テキストファイルを保存しました');
  });

  // クリップボード書き込み共通関数
  function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
      }).catch(err => {
        fallbackCopyTextToClipboard(text, successMessage);
      });
    } else {
      fallbackCopyTextToClipboard(text, successMessage);
    }
  }

  function fallbackCopyTextToClipboard(text, successMessage) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast(successMessage);
      } else {
        showToast('コピーに失敗しました');
      }
    } catch (err) {
      showToast('コピーに失敗しました');
    }
    document.body.removeChild(textArea);
  }

  // 初期化時文字数表示
  updateCharCount();
});
