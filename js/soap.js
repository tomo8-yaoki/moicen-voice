/**
 * 音声入力SOAPノート - SOAP分類ロジック
 */

// SOAP各分類のキーワード辞書（大文字小文字対応、表記揺れ対応）
const SOAP_RULES = {
  S: {
    name: 'Subjective（主観的情報）',
    color: 'blue',
    keywords: [
      '痛い', '痛む', '痛み', '疼痛', 'つらい', '辛い', 'しびれる', '痺れる', 'しびれ', '痺れ',
      'だるい', '倦怠感', '動かしにくい', '不安', '心配', '眠れない', '不眠', '訴え', '訴える',
      '苦しい', '違和感', 'こわばる', '張る', '気分'
    ]
  },
  O: {
    name: 'Objective（客観的情報）',
    color: 'green',
    keywords: [
      'ROM', 'rom', 'MMT', 'mmt', '度', 'cm', 'CM', 'kg', 'KG', 'mmHg', 'MMHG',
      '回', '秒', '分', '歩行', '握力', 'バイタル', '血圧', '脈拍', '心拍', 'SpO2', '体温',
      '腫脹', '腫れ', '熱感', '発赤', '浮腫', '可動域', '徒手筋力テスト', '反射', '検査'
    ]
  },
  A: {
    name: 'Assessment（評価・分析）',
    color: 'amber',
    keywords: [
      '考えられる', '考える', '原因', '問題', '課題', '改善', '向上',
      '低下', '減弱', '制限', '障害', 'リスク', '危険性', '評価', '分析',
      '影響', '可能性', '予後', '要因'
    ]
  },
  P: {
    name: 'Plan（治療・支援計画）',
    color: 'red',
    keywords: [
      'プログラム', '目標', 'ゴール', '実施', '行う', '継続', '進める',
      '指導', 'アドバイス', '週', '回', 'セット', '退院', '自主トレ',
      '処方', 'リハビリ', '訓練', '介入', '予定', '次回'
    ]
  }
};

/**
 * テキストを文単位に分割する
 * 句点（。）、感嘆符（！）、疑問符（？）、改行などで分割
 * @param {string} text
 * @returns {string[]} 分割された文の配列
 */
function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];

  // 正規表現で句点、改行、感嘆符、疑問符で分割（区切り文字の後ろで分割）
  // 句点・改行等を含む形式で分割
  const rawParts = text
    .replace(/[\r\n]+/g, '。\n') // 改行も文の区切りとする
    .split(/(?<=[。！？!?\n])/);

  const sentences = [];
  for (let part of rawParts) {
    const trimmed = part.trim().replace(/^[\n\r]+|[\n\r]+$/g, '');
    if (trimmed.length > 0) {
      sentences.push(trimmed);
    }
  }

  // もし句点が一切なく、スペース区切りや長い単一文だった場合でも
  // 1文として扱うか、複数行をそのまま保持
  if (sentences.length === 0 && text.trim().length > 0) {
    sentences.push(text.trim());
  }

  return sentences;
}

/**
 * 文中のキーワードを検索し、一致したキーワード情報を返す
 * @param {string} sentence
 * @param {string[]} keywords
 * @returns {{matched: boolean, keywords: string[]}}
 */
function matchKeywords(sentence, keywords) {
  const matchedList = [];
  const lowerSentence = sentence.toLowerCase();

  for (const kw of keywords) {
    const lowerKw = kw.toLowerCase();
    if (lowerSentence.includes(lowerKw)) {
      matchedList.push(kw);
    }
  }

  return {
    matched: matchedList.length > 0,
    keywords: Array.from(new Set(matchedList))
  };
}

/**
 * 文中の指定キーワードをハイライト用HTMLに置換する
 * @param {string} sentence
 * @param {string[]} matchedKeywords
 * @returns {string} ハイライトされたHTML文字列
 */
function highlightKeywords(sentence, matchedKeywords) {
  if (!matchedKeywords || matchedKeywords.length === 0) {
    return escapeHtml(sentence);
  }

  // 長いキーワード順にソート（部分一致の重複誤爆を防ぐ）
  const sorted = [...matchedKeywords].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'gi');

  const escaped = escapeHtml(sentence);
  // HTMLエスケープ後に置換
  return escaped.replace(pattern, '<mark class="kw-highlight">$1</mark>');
}

/**
 * HTMLエスケープヘルパー
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 正規表現特殊文字のエスケープ
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 全文を受け取り、SOAPおよび未分類に振り分けた結果オブジェクトを返す
 * @param {string} fullText
 * @returns {{
 *   sentences: string[],
 *   categories: {
 *     s: Array<{sentence: string, html: string, keywords: string[]}>,
 *     o: Array<{sentence: string, html: string, keywords: string[]}>,
 *     a: Array<{sentence: string, html: string, keywords: string[]}>,
 *     p: Array<{sentence: string, html: string, keywords: string[]}>,
 *     unclassified: Array<{sentence: string, html: string, keywords: string[]}>
 *   },
 *   counts: { s: number, o: number, a: number, p: number, unclassified: number, total: number }
 * }}
 */
function classifySoapText(fullText) {
  const sentences = splitSentences(fullText);

  const results = {
    s: [],
    o: [],
    a: [],
    p: [],
    unclassified: []
  };

  for (const sentence of sentences) {
    const matchS = matchKeywords(sentence, SOAP_RULES.S.keywords);
    const matchO = matchKeywords(sentence, SOAP_RULES.O.keywords);
    const matchA = matchKeywords(sentence, SOAP_RULES.A.keywords);
    const matchP = matchKeywords(sentence, SOAP_RULES.P.keywords);

    let classified = false;

    if (matchS.matched) {
      results.s.push({
        sentence,
        html: highlightKeywords(sentence, matchS.keywords),
        keywords: matchS.keywords
      });
      classified = true;
    }

    if (matchO.matched) {
      results.o.push({
        sentence,
        html: highlightKeywords(sentence, matchO.keywords),
        keywords: matchO.keywords
      });
      classified = true;
    }

    if (matchA.matched) {
      results.a.push({
        sentence,
        html: highlightKeywords(sentence, matchA.keywords),
        keywords: matchA.keywords
      });
      classified = true;
    }

    if (matchP.matched) {
      results.p.push({
        sentence,
        html: highlightKeywords(sentence, matchP.keywords),
        keywords: matchP.keywords
      });
      classified = true;
    }

    if (!classified) {
      results.unclassified.push({
        sentence,
        html: escapeHtml(sentence),
        keywords: []
      });
    }
  }

  const counts = {
    s: results.s.length,
    o: results.o.length,
    a: results.a.length,
    p: results.p.length,
    unclassified: results.unclassified.length,
    total: sentences.length
  };

  return {
    sentences,
    categories: results,
    counts
  };
}

/**
 * 分類結果を整形したテキスト形式で出力する（コピー・保存用）
 * @param {Object} classification
 * @returns {string}
 */
function formatSoapAsText(classification) {
  const { categories } = classification;
  const sections = [];

  const addSection = (title, items) => {
    sections.push(`【${title}】`);
    if (items.length === 0) {
      sections.push('（記載なし）\n');
    } else {
      items.forEach(item => sections.push(`・${item.sentence}`));
      sections.push('');
    }
  };

  addSection('S: 主観的情報 (Subjective)', categories.s);
  addSection('O: 客観的情報 (Objective)', categories.o);
  addSection('A: 評価・分析 (Assessment)', categories.a);
  addSection('P: 治療・支援計画 (Plan)', categories.p);

  if (categories.unclassified.length > 0) {
    addSection('未分類 (Unclassified)', categories.unclassified);
  }

  return sections.join('\n');
}

// グローバルスコープへ公開（ブラウザおよびNode.js対応）
if (typeof window !== 'undefined') {
  window.SoapClassifier = {
    SOAP_RULES,
    splitSentences,
    classifySoapText,
    formatSoapAsText
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SOAP_RULES,
    splitSentences,
    classifySoapText,
    formatSoapAsText
  };
}
