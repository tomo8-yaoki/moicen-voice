/**
 * 音声入力SOAPノート - Web Speech API 音声認識マネージャー
 */

class SpeechRecognitionManager {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isAvailable = !!SpeechRecognition;
    this.recognition = this.isAvailable ? new SpeechRecognition() : null;

    this.isListening = false;
    this.manualStop = false;
    this.accumulatedText = '';
    this.interimText = '';

    // コールバック関数
    this.onInterimCallback = null;
    this.onFinalCallback = null;
    this.onStatusChangeCallback = null;
    this.onErrorCallback = null;

    if (this.isAvailable) {
      this.initRecognition();
    }
  }

  /**
   * ブラウザがWeb Speech APIに対応しているか
   */
  isSupported() {
    return this.isAvailable;
  }

  /**
   * 認識エンジンの初期化設定
   */
  initRecognition() {
    const r = this.recognition;
    r.continuous = true;       // 連続認識を有効化
    r.interimResults = true;   // リアルタイム認識結果（暫定）を有効化
    r.lang = 'ja-JP';          // 日本語
    r.maxAlternatives = 1;

    r.onstart = () => {
      this.isListening = true;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback('recording');
      }
    };

    r.onresult = (event) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }

      this.interimText = interim;

      if (finalChunk) {
        // 日本語文の自然な末尾補正（句点がない場合に句点を付与しやすくする）
        let chunkToAdd = finalChunk.trim();
        if (chunkToAdd.length > 0) {
          // 直前のテキストとの接続
          if (this.accumulatedText && !this.accumulatedText.endsWith('。') && !this.accumulatedText.endsWith('\n')) {
            this.accumulatedText += '。';
          }
          this.accumulatedText += chunkToAdd;
        }

        if (this.onFinalCallback) {
          this.onFinalCallback(this.accumulatedText);
        }
      }

      if (this.onInterimCallback) {
        this.onInterimCallback(this.interimText, this.accumulatedText);
      }
    };

    r.onerror = (event) => {
      console.warn('Speech recognition event error:', event.error);
      let errorMsg = '音声認識エラーが発生しました。';

      switch (event.error) {
        case 'not-allowed':
          errorMsg = 'マイクの使用が許可されていません。ブラウザのアドレスバーからマイクの利用を許可してください。';
          break;
        case 'audio-capture':
          errorMsg = 'マイクが検出されませんでした。マイクの接続設定を確認してください。';
          break;
        case 'network':
          errorMsg = '音声認識サーバーとのネットワーク通信に失敗しました。インターネット接続を確認してください。';
          break;
        case 'no-speech':
          // 無音時はエラー通知せず待機継続
          return;
        case 'aborted':
          // 意図的な中断
          return;
        default:
          errorMsg = `音声認識エラー: ${event.error}`;
      }

      if (this.onErrorCallback) {
        this.onErrorCallback(errorMsg);
      }
    };

    r.onend = () => {
      // ユーザーが停止ボタンを押したのではなく、ブラウザが無音等の理由で自動終了した場合
      if (this.isListening && !this.manualStop) {
        try {
          // 自動再開して連続録音を維持
          r.start();
          return;
        } catch (e) {
          console.warn('Recognition restart failed:', e);
        }
      }

      this.isListening = false;
      this.interimText = '';
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback('idle');
      }
      if (this.onInterimCallback) {
        this.onInterimCallback('', this.accumulatedText);
      }
    };
  }

  /**
   * 音声認識を開始する
   * @param {string} initialText 既存のテキストエリア文字列（追記用）
   * @param {Object} callbacks
   */
  start(initialText = '', callbacks = {}) {
    if (!this.isAvailable) {
      if (callbacks.onError) {
        callbacks.onError('Web Speech API に対応していません。Google Chrome または Microsoft Edge をご利用ください。');
      }
      return false;
    }

    if (this.isListening) {
      return true;
    }

    this.accumulatedText = initialText || '';
    this.interimText = '';
    this.manualStop = false;

    this.onInterimCallback = callbacks.onInterim || null;
    this.onFinalCallback = callbacks.onFinal || null;
    this.onStatusChangeCallback = callbacks.onStatusChange || null;
    this.onErrorCallback = callbacks.onError || null;

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.error('Failed to start recognition:', err);
      if (this.onErrorCallback) {
        this.onErrorCallback('音声認識の開始に失敗しました。ブラウザのマイク権限をご確認ください。');
      }
      return false;
    }
  }

  /**
   * 音声認識を停止する
   */
  stop() {
    if (!this.isAvailable || !this.isListening) {
      return;
    }

    this.manualStop = true;
    this.isListening = false;

    try {
      this.recognition.stop();
    } catch (err) {
      console.warn('Error stopping recognition:', err);
    }
  }

  /**
   * 累積テキストの取得
   */
  getText() {
    return this.accumulatedText;
  }

  /**
   * 累積テキストの手動設定
   */
  setText(text) {
    this.accumulatedText = text;
  }
}

// グローバルスコープへ公開
window.SpeechRecognitionManager = SpeechRecognitionManager;
