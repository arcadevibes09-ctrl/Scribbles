// FILE: src/myNotesStudio/CreateStudyModal.jsx
import React, { useState, useRef } from 'react';
import {
  Sparkles,
  FileText,
  Cpu,
  Key,
  Upload,
  Copy,
  Check,
  Edit3,
  ClipboardPaste
} from 'lucide-react';
import {
  AI_PROVIDERS,
  loadSavedApiKeys,
  saveApiKeys,
  buildSuruStudyPrompt,
  generateStudyDeckFromAI,
  parseAIResponseIntoDeck
} from './aiRouter';
import {
  SUPPORTED_EXTENSIONS,
  extractTextFromFile,
  chunkDocumentIntoChapters
} from './fileIngestor';

export default function CreateStudyModal({ onDeckCreated, onOpenClassicEditor }) {
  const [activeTab, setActiveTab] = useState('magic_paste');

  const [topicInput, setTopicInput] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedResponse, setPastedResponse] = useState('');

  const [selectedAI, setSelectedAI] = useState('gemini');
  const [apiKeys, setApiKeys] = useState(() => loadSavedApiKeys());
  const [showKeyBox, setShowKeyBox] = useState(false);

  const [busyStatus, setBusyStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);
  const currentProvider = AI_PROVIDERS.find((p) => p.id === selectedAI) || AI_PROVIDERS[0];

  const handleCopyMagicPrompt = async () => {
    if (!topicInput.trim()) return;
    const magicPrompt = buildSuruStudyPrompt(topicInput.trim());
    try {
      await navigator.clipboard.writeText(magicPrompt);
    } catch {
      // ignore
    }
    setPromptCopied(true);
    setShowPasteBox(true);
  };

  const handleBuildFromPaste = (e) => {
    e.preventDefault();
    if (!pastedResponse.trim()) return;
    const stackTitle = topicInput.trim() || 'Study Stack';
    const newDeck = parseAIResponseIntoDeck(pastedResponse, stackTitle);
    onDeckCreated(newDeck);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setBusyStatus(`Reading ${file.name}...`);

    try {
      const rawText = await extractTextFromFile(file, (msg) => setBusyStatus(msg));
      if (!rawText || !rawText.trim()) {
        throw new Error('Could not find readable text in this file.');
      }
      setBusyStatus('Structuring chapters...');
      const newDeck = chunkDocumentIntoChapters(rawText, file.name);
      setBusyStatus('');
      onDeckCreated(newDeck);
    } catch (err) {
      setBusyStatus('');
      setErrorMsg(err.message || 'Failed to read file.');
    }
  };

  const handleKeyChange = (providerId, value) => {
    const next = { ...apiKeys, [providerId]: value };
    setApiKeys(next);
    saveApiKeys(next);
  };

  const handleRunDirectAI = async (e) => {
    e.preventDefault();
    if (!topicInput.trim() || busyStatus) return;
    setErrorMsg('');
    setBusyStatus('Generating stack...');

    try {
      const newDeck = await generateStudyDeckFromAI({
        studyRequest: topicInput.trim(),
        providerId: selectedAI,
        apiKeys,
        onStatus: (msg) => setBusyStatus(msg)
      });
      setBusyStatus('');
      onDeckCreated(newDeck);
    } catch (err) {
      setBusyStatus('');
      setErrorMsg(err.message || 'API error. Use Magic AI tab instead.');
    }
  };

  return (
    <div className="mns-shell">
      {/* Universal Button Bar (Matches Quicksand / Top-bar pills 100%) */}
      <div className="mns-uni-pill-row">
        <button
          type="button"
          className={`uni-btn subtle ${activeTab === 'magic_paste' ? 'active' : ''}`}
          onClick={() => setActiveTab('magic_paste')}
        >
          <Sparkles size={13} />
          <span>Magic AI</span>
        </button>

        <button
          type="button"
          className={`uni-btn subtle ${activeTab === 'import_file' ? 'active' : ''}`}
          onClick={() => setActiveTab('import_file')}
        >
          <FileText size={13} />
          <span>PDF / Book</span>
        </button>

        <button
          type="button"
          className={`uni-btn subtle ${activeTab === 'direct_ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('direct_ai')}
        >
          <Cpu size={13} />
          <span>Auto API</span>
        </button>

        <button
          type="button"
          className="uni-btn subtle"
          onClick={onOpenClassicEditor}
          title="Blank Manual Note"
        >
          <Edit3 size={13} />
        </button>
      </div>

      {/* OUTER BOX: Transparent with faint border | INNER ELEMENTS: Filled surface */}
      {activeTab === 'magic_paste' && (
        <div className="mns-outer-frame">
          <div className="mns-step-badge">STEP 1 · TOPIC</div>
          <h2 className="mns-minimal-title">What do you wish to study?</h2>

          <input
            className="mns-inner-surface-input"
            placeholder="Type topic (e.g. Cranial Nerves, Rich Dad)..."
            value={topicInput}
            onChange={(e) => {
              setTopicInput(e.target.value);
              if (promptCopied) setPromptCopied(false);
            }}
          />

          {topicInput.trim().length > 0 && (
            <div className="mns-progressive-reveal">
              <button
                type="button"
                className={`uni-btn subtle active mns-full-uni-btn ${promptCopied ? 'copied' : ''}`}
                onClick={handleCopyMagicPrompt}
              >
                {promptCopied ? <Check size={14} /> : <Copy size={14} />}
                <span>
                  {promptCopied
                    ? 'Magic Prompt Copied!'
                    : `Copy Magic Prompt · "${topicInput.trim().slice(0, 18)}${
                        topicInput.trim().length > 18 ? '…' : ''
                      }"`}
                </span>
              </button>

              {!showPasteBox && (
                <button
                  type="button"
                  className="mns-text-link"
                  onClick={() => setShowPasteBox(true)}
                >
                  Already copied response? Paste →
                </button>
              )}
            </div>
          )}

          {!topicInput.trim() && !showPasteBox && (
            <button
              type="button"
              className="mns-text-link"
              onClick={() => setShowPasteBox(true)}
            >
              <ClipboardPaste size={13} /> Or paste any shared AI note directly →
            </button>
          )}

          {showPasteBox && (
            <form className="mns-progressive-reveal mns-paste-zone" onSubmit={handleBuildFromPaste}>
              <div className="mns-inner-surface-pill">
                <span>1. Paste in AI</span>
                <span>→</span>
                <span>2. Copy reply</span>
                <span>→</span>
                <span>3. Drop below</span>
              </div>

              <textarea
                className="mns-inner-surface-textarea"
                rows={6}
                placeholder="Paste the AI response here..."
                value={pastedResponse}
                onChange={(e) => setPastedResponse(e.target.value)}
                autoFocus
              />

              <button
                type="submit"
                className="uni-btn subtle active mns-full-uni-btn"
                disabled={!pastedResponse.trim()}
              >
                <Sparkles size={14} />
                <span>Build Study Stack</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: PDF / BOOK / WORD */}
      {activeTab === 'import_file' && (
        <div className="mns-outer-frame">
          <div className="mns-step-badge">BOOK & DOCUMENT ENGINE</div>
          <h2 className="mns-minimal-title">Import Book, PDF, or Word</h2>

          <div className="mns-symbol-row">
            {['PDF', 'DOCX', 'EPUB', 'TXT', 'MD', 'CSV'].map((fmt) => (
              <span key={fmt} className="uni-btn subtle mns-mini-tag">
                {fmt}
              </span>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_EXTENSIONS}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {errorMsg && <div className="mns-alert error">{errorMsg}</div>}
          {busyStatus && <div className="mns-alert status">{busyStatus}</div>}

          <button
            type="button"
            className="mns-inner-surface-dropzone"
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(busyStatus)}
          >
            <Upload size={20} color="#cfcfcf" />
            <span>Select File from Device</span>
            <small>Merges chapters & formats subheadings automatically</small>
          </button>
        </div>
      )}

      {/* TAB 3: AUTO API */}
      {activeTab === 'direct_ai' && (
        <form className="mns-outer-frame" onSubmit={handleRunDirectAI}>
          <div className="mns-step-badge">DIRECT ENGINE</div>
          <h2 className="mns-minimal-title">Auto-Generate via API</h2>

          <input
            className="mns-inner-surface-input"
            placeholder="Topic to generate..."
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
          />

          <div className="mns-ai-compact-grid">
            {AI_PROVIDERS.map((prov) => (
              <button
                type="button"
                key={prov.id}
                className={`mns-inner-ai-card ${selectedAI === prov.id ? 'selected' : ''}`}
                onClick={() => setSelectedAI(prov.id)}
              >
                <span className="mns-ai-mini-title">{prov.name}</span>
                <span className="mns-ai-mini-sub">{prov.badge}</span>
              </button>
            ))}
          </div>

          {currentProvider.needsKey && (
            <div className="mns-key-wrap">
              <button
                type="button"
                className="mns-text-link"
                onClick={() => setShowKeyBox((p) => !p)}
              >
                <Key size={12} />{' '}
                {apiKeys[selectedAI] ? 'API Key Saved (Edit)' : `Add ${currentProvider.name} Key`}
              </button>

              {(showKeyBox || !apiKeys[selectedAI]) && (
                <input
                  type="password"
                  className="mns-inner-surface-input"
                  placeholder={currentProvider.keyPlaceholder}
                  value={apiKeys[selectedAI] || ''}
                  onChange={(e) => handleKeyChange(selectedAI, e.target.value)}
                />
              )}
            </div>
          )}

          {errorMsg && <div className="mns-alert error">{errorMsg}</div>}
          {busyStatus && <div className="mns-alert status">{busyStatus}</div>}

          <button
            type="submit"
            className="uni-btn subtle active mns-full-uni-btn"
            disabled={!topicInput.trim() || Boolean(busyStatus)}
          >
            <Sparkles size={14} />
            <span>Generate Now</span>
          </button>
        </form>
      )}
    </div>
  );
}
