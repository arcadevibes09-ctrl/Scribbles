// FILE: src/myNotesStudio/MyNotesHub.jsx
import React, { useState, useEffect } from 'react';
import { Sparkles, Layers, BookOpen } from 'lucide-react';
import SquareStack from '../components/SquareStack';
import NotesView from '../components/NotesView';
import NotebookPage from '../NotebookPage';
import CreateStudyModal from './CreateStudyModal';
import './myNotesStudio.css';

const DECKS_STORAGE_KEY = 'suru_custom_study_decks_v1';

export default function MyNotesHub({
  subScreen,
  setSubScreen,
  userNotes,
  setUserNotes,
  readerFontSize = 1.0,
  immersiveNotes = false,
  setImmersiveNotes,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}) {
  const [customDecks, setCustomDecks] = useState(() => {
    try {
      const saved = localStorage.getItem(DECKS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeDeck, setActiveDeck] = useState(null);
  const [activeChapter, setActiveChapter] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(customDecks));
    } catch {
      // ignore quota error
    }
  }, [customDecks]);

  const personalNotesDeck = {
    id: 'deck_personal_saved',
    title: 'Quick Notes',
    badge: `${userNotes.length}`,
    theme: 'shade-3',
    icon: <BookOpen size={19} color="#e5e5e5" />,
    subtitle: 'Personal Notebook',
    description: 'Handwritten notes & custom glossaries.',
    items: userNotes.map((n, idx) => ({
      id: n.id,
      title: `${String(idx + 1).padStart(2, '0')} · ${n.title || 'Untitled'}`,
      subtitle: n.subtitle || n.folder || 'Personal',
      text: n.text || '',
      glossary: n.glossary || {}
    }))
  };

  const hubSlides = [
    {
      id: 'slide_create_notes',
      title: 'Create',
      badge: '✦ AI · PDF',
      theme: 'shade-1',
      icon: <Sparkles size={20} color="#e5e5e5" />,
      subtitle: 'New Study Stack',
      description: 'Magic AI prompt, paste shared notes, or drop a PDF / book.',
      directOpen: true
    },
    {
      id: 'slide_my_library_stacks',
      title: 'Library',
      badge: `${customDecks.length + (userNotes.length > 0 ? 1 : 0)} STACKS`,
      theme: 'shade-2',
      icon: <Layers size={20} color="#e5e5e5" />,
      subtitle: 'Saved Books & Topics',
      description: 'Open your structured chapters and study decks.',
      directOpen: true
    }
  ];

  const libraryCards = [
    ...customDecks.map((deck, idx) => ({
      id: deck.id,
      title: deck.title,
      badge: deck.badge || `${deck.topics?.length || 0}`,
      theme: `shade-${(idx % 4) + 1}`,
      icon: <Layers size={19} color="#e5e5e5" />,
      subtitle: deck.subtitle || `${deck.topics?.length || 0} Chapters`,
      description: `${deck.createdAt || 'Saved'} · Tap to pick a chapter.`,
      deckObj: deck,
      items: (deck.topics || []).map((t, cIdx) => ({
        id: t.id,
        title: `${String(cIdx + 1).padStart(2, '0')} · ${t.title}`,
        subtitle: t.subtitle,
        topicObj: t
      }))
    })),
    ...(userNotes.length > 0 ? [personalNotesDeck] : [])
  ];

  const handleOpenHubSlide = (card) => {
    if (card.id === 'slide_create_notes') {
      setSubScreen('create_modal');
    } else if (card.id === 'slide_my_library_stacks') {
      if (libraryCards.length === 0) setSubScreen('create_modal');
      else setSubScreen('decks_stack');
    }
  };

  const handleDeckCreated = (newDeck) => {
    setCustomDecks((prev) => [newDeck, ...prev]);
    setActiveDeck(newDeck);
    setActiveChapter(newDeck.topics?.[0] || null);
    setSubScreen('chapter_reader');
  };

  const handleSelectChapterFromStack = (card, item) => {
    if (card.id === 'deck_personal_saved') {
      setActiveDeck({ title: 'Quick Notes', topics: personalNotesDeck.items });
      setActiveChapter(item);
      setSubScreen('chapter_reader');
      return;
    }
    const deck = card.deckObj;
    setActiveDeck(deck);
    setActiveChapter(item.topicObj || item);
    setSubScreen('chapter_reader');
  };

  // Delete an entire stack from the expanded chapter list screen
  const handleDeleteDeck = (deckId) => {
    if (deckId === 'deck_personal_saved') return;
    setCustomDecks((prev) => prev.filter((d) => d.id !== deckId));
  };

  // Optional: Delete a single chapter from the chapter list
  const handleDeleteChapterItem = (card, item) => {
    if (card.id === 'deck_personal_saved') {
      setUserNotes((prev) => prev.filter((n) => n.id !== item.id));
      return;
    }
    setCustomDecks((prev) =>
      prev
        .map((d) =>
          d.id === card.id
            ? { ...d, topics: (d.topics || []).filter((t) => t.id !== item.id) }
            : d
        )
        .filter((d) => (d.topics || []).length > 0)
    );
  };

  const chapterList = activeDeck?.topics || [];
  const currentChIndex = activeChapter
    ? chapterList.findIndex((c) => c.id === activeChapter.id)
    : -1;
  const hasPrevCh = currentChIndex > 0;
  const hasNextCh = currentChIndex !== -1 && currentChIndex < chapterList.length - 1;

  if (subScreen === 'classic_notes') {
    return (
      <div className="full-page-container">
        <NotesView notes={userNotes} setNotes={setUserNotes} />
      </div>
    );
  }

  if (subScreen === 'create_modal') {
    return (
      <CreateStudyModal
        onDeckCreated={handleDeckCreated}
        onOpenClassicEditor={() => setSubScreen('classic_notes')}
      />
    );
  }

  // Clean Stack View: Uses your original libraryCards + passes delete handlers only here
  if (subScreen === 'decks_stack') {
    return (
      <SquareStack
        deckTitle="MY LIBRARY STACKS"
        cards={libraryCards}
        onSelectItem={handleSelectChapterFromStack}
        onDeleteCard={handleDeleteDeck}
        onDeleteItem={handleDeleteChapterItem}
      />
    );
  }

  // Full NotebookPage integration — Delete button removed from here!
  if (subScreen === 'chapter_reader' && activeChapter) {
    return (
      <div
        className="full-page-container"
        onDoubleClick={() => setImmersiveNotes && setImmersiveNotes((prev) => !prev)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ fontSize: `${readerFontSize}rem` }}
      >
        <div className="full-page-header-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="full-page-title" style={{ wordBreak: 'break-word' }}>
              {activeChapter.title}
            </h1>
            {!immersiveNotes && (
              <p className="full-page-sub">{activeChapter.subtitle}</p>
            )}
          </div>
        </div>

        <NotebookPage
          topicId={activeChapter.id}
          topicData={{
            text: activeChapter.text,
            glossary: activeChapter.glossary || {}
          }}
          hasPrevTopic={hasPrevCh}
          hasNextTopic={hasNextCh}
          onPrevTopic={() => hasPrevCh && setActiveChapter(chapterList[currentChIndex - 1])}
          onNextTopic={() => hasNextCh && setActiveChapter(chapterList[currentChIndex + 1])}
        />
      </div>
    );
  }

  return (
    <SquareStack
      deckTitle="NOTES STUDIO"
      cards={hubSlides}
      onDirectOpenCard={handleOpenHubSlide}
      onSelectItem={handleOpenHubSlide}
    />
  );
}
