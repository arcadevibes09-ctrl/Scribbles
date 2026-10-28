// FILE: src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft
} from 'lucide-react';
import { StatusBar, Style } from '@capacitor/status-bar';

import SquareStack from './components/SquareStack';
import GymView from './components/GymView';
import MyNotesHub from './myNotesStudio/MyNotesHub';
import NotebookPage from './NotebookPage';
import Task from './Task';
import Competition from './Competition';
import CustomSelect from './CustomSelect';
import MountainSyllabusView from './components/mountain/MountainSyllabusView';
import SyllabusViewToggle from './components/mountain/SyllabusViewToggle';

import {
  semesterCatalog,
  getAllTopicsForSemester,
  getTopicsFromSubject
} from './data/data_structure';

import { simpleData } from './data/data_simple';
import { suruData } from './data/data_suru';
import { getRootCards } from './data/data_cards.jsx';


import './styles/App.css';

const allModeData = {
  simple: simpleData,
  suru: suruData
};

const modesOrder = ['simple', 'suru'];

const fonts = [
  { name: 'Paper Daisy', value: "'Paper Daisy', 'Mali', cursive" },
  { name: 'Unrulyness', value: "'Unrulyness', 'Gloria Hallelujah', cursive" },
  { name: 'Gaegu', value: "'Gaegu', cursive" },
  { name: 'Oliver', value: "'Oliver', 'Patrick Hand', cursive" },
  { name: 'Joyline Notes', value: "'Joyline Notes', 'Indie Flower', cursive" },
  { name: 'Simple Handwriting', value: "'Simple Handwriting', 'Shadows Into Light Two', cursive" },
  { name: 'Pretty Notes', value: "'Pretty Notes', 'Short Stack', cursive" },
  { name: 'Biro Spirit', value: "'Biro Spirit', 'Caveat', cursive" },
  { name: 'Simple Script', value: "'Simple Script', 'Dancing Script', cursive" },
  { name: 'Dreaming Outloud', value: "'Dreaming Outloud', 'Reenie Beanie', cursive" },
  { name: 'Quicksand', value: "'Quicksand', sans-serif" }
];

const DEFAULT_GYM = {
  lastBodyWeight: 70,
  prs: [
    { name: 'BENCH PRESS', value: 80 },
    { name: 'SQUAT', value: 100 },
    { name: 'DEADLIFT', value: 120 }
  ],
  logsByDate: {}
};

export default function App() {
  const [screen, setScreen] = useState('root_stack');
  const [notesSubScreen, setNotesSubScreen] = useState('two_slides');

  const [selectedSemester, setSelectedSemester] = useState('sem_5');
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeTopicList, setActiveTopicList] = useState([]);
  const [currentMode, setCurrentMode] = useState('simple');
  const [currentFont, setCurrentFont] = useState(fonts[10].value);
  const [scores, setScores] = useState({ user: 35, opponent: 20 });

  const [mountainSyllabusMode, setMountainSyllabusMode] = useState(false);
  const [mountainStage, setMountainStage] = useState('dots');

  const isSyllabusScreen =
    screen === 'semester_stack' ||
    screen === 'subject_stack' ||
    screen === 'topic_full';

  const isReadingNotebookPage =
    screen === 'topic_full' ||
    (isSyllabusScreen && mountainSyllabusMode && mountainStage === 'page') ||
    (screen === 'my_notes_full' &&
      (notesSubScreen === 'chapter_reader' || notesSubScreen === 'classic_notes'));

  const [immersiveNotes, setImmersiveNotes] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState(1.0);
  const lastTouchDistance = useRef(null);

  const [userNotes, setUserNotes] = useState(() => {
    const saved = localStorage.getItem('suru_user_notes_v5');
    return saved ? JSON.parse(saved) : [];
  });

  const [gymData, setGymData] = useState(() => {
    const saved = localStorage.getItem('suru_gym_v5');
    return saved ? JSON.parse(saved) : DEFAULT_GYM;
  });

  useEffect(() => {
    localStorage.setItem('suru_user_notes_v5', JSON.stringify(userNotes));
  }, [userNotes]);

  useEffect(() => {
    localStorage.setItem('suru_gym_v5', JSON.stringify(gymData));
  }, [gymData]);

  useEffect(() => {
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isReadingNotebookPage) {
      setImmersiveNotes(false);
    }
  }, [isReadingNotebookPage]);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayLog = gymData.logsByDate?.[todayKey];
  const activeArenaTopics = getAllTopicsForSemester(selectedSemester);
  const activeSemBadge = semesterCatalog[selectedSemester]?.badge || 'SEM';

  // Root cards generated from the dedicated data file (includes your Omkar Rathod profile card)
  const rootCards = getRootCards(
    userNotes.length,
    todayLog,
    activeSemBadge,
    activeArenaTopics,
    scores.user
  );

  const semesterCards = Object.keys(semesterCatalog).map((semKey, idx) => {
    const sem = semesterCatalog[semKey];
    const subjectList = Object.keys(sem.subjects).map((subKey) => ({
      id: subKey,
      title: sem.subjects[subKey].title,
      subtitle: sem.subjects[subKey].subtitle,
      semKey: semKey
    }));

    return {
      id: sem.id,
      semKey: semKey,
      title: sem.title,
      badge: sem.badge,
      theme: `shade-${(idx % 4) + 1}`,
      subtitle: sem.subtitle,
      description: sem.description,
      directOpen: true,
      items: subjectList
    };
  });

  const activeSemObj = semesterCatalog[selectedSemester] || semesterCatalog.sem_5;
  const subjectCards = Object.keys(activeSemObj.subjects).map((subKey, idx) => {
    const sub = activeSemObj.subjects[subKey];
    return {
      id: `sub_${subKey}`,
      title: sub.title,
      badge: sub.badge,
      theme: `shade-${(idx % 4) + 1}`,
      subtitle: sub.subtitle,
      description: sub.description,
      items: getTopicsFromSubject(sub)
    };
  });

  const handleRootDirectOpen = (card) => {
    if (card.id === 'card_profile') return; // Profile card is info only
    if (card.id === 'card_my_notes') {
      setNotesSubScreen('two_slides');
      setScreen('my_notes_full');
    }
    if (card.id === 'card_suru_notes') {
      setMountainStage('dots');
      setScreen('semester_stack');
    }
    if (card.id === 'card_gym') setScreen('gym_full');
    if (card.id === 'card_tasks') setScreen('tasks_full');
  };

  const handleRootItemSelect = (card, item) => {
    if (card.id === 'card_arena' && item.topicObj) {
      setActiveTopic(item.topicObj);
      setScreen('comp_full');
    }
  };

  const handleSemesterDirectOpen = (semCard) => {
    setSelectedSemester(semCard.semKey);
    setScreen('subject_stack');
  };

  const handleSubjectTopicSelect = (subjectCard, topicItem) => {
    const list = subjectCard?.items?.length ? subjectCard.items : activeArenaTopics;
    setActiveTopicList(list);
    setActiveTopic(topicItem);
    setScreen('topic_full');
  };

  const topicPool = activeTopicList.length > 0 ? activeTopicList : activeArenaTopics;
  const currentTopicIndex = activeTopic
    ? topicPool.findIndex((t) => t.id === activeTopic.id)
    : -1;
  const hasPrevTopic = currentTopicIndex > 0;
  const hasNextTopic =
    currentTopicIndex !== -1 && currentTopicIndex < topicPool.length - 1;

  const handleNextTopic = () => {
    if (hasNextTopic) setActiveTopic(topicPool[currentTopicIndex + 1]);
  };

  const handlePrevTopic = () => {
    if (hasPrevTopic) setActiveTopic(topicPool[currentTopicIndex - 1]);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      lastTouchDistance.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && lastTouchDistance.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastTouchDistance.current;
      if (Math.abs(delta) > 8) {
        setReaderFontSize((prev) =>
          Number(Math.min(Math.max(0.75, prev + (delta > 0 ? 0.04 : -0.04)), 2.2).toFixed(2))
        );
        lastTouchDistance.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
  };

  const handleUniversalBack = () => {
    if (screen === 'my_notes_full') {
      if (notesSubScreen === 'chapter_reader') {
        setImmersiveNotes(false);
        setNotesSubScreen('decks_stack');
        return;
      }
      if (
        notesSubScreen === 'decks_stack' ||
        notesSubScreen === 'create_modal' ||
        notesSubScreen === 'classic_notes'
      ) {
        setImmersiveNotes(false);
        setNotesSubScreen('two_slides');
        return;
      }
      setScreen('root_stack');
      return;
    }

    if (mountainSyllabusMode && isSyllabusScreen) {
      if (mountainStage === 'page') {
        setImmersiveNotes(false);
        setMountainStage('pill');
        return;
      }
      if (mountainStage === 'pill') {
        setMountainStage('dots');
        return;
      }
      setMountainSyllabusMode(false);
      setScreen('root_stack');
      return;
    }

    if (screen === 'topic_full') setScreen('subject_stack');
    else if (screen === 'subject_stack') setScreen('semester_stack');
    else setScreen('root_stack');
  };

  const basePayload =
    (activeTopic && simpleData?.[activeTopic.id]) || {
      text: `## ${activeTopic?.title || 'Note'}\n\nSyllabus unit ready.`,
      glossary: {}
    };

  const activeModePayload =
    activeTopic && allModeData[currentMode]?.[activeTopic.id]
      ? allModeData[currentMode][activeTopic.id]
      : basePayload;

  return (
    <div
      className={`reimagined-app ${immersiveNotes ? 'immersive-active' : ''}`}
      style={{ fontFamily: currentFont }}
    >
      <div className="minimal-topbar">
        <div>
          {screen !== 'root_stack' ? (
            <button
              className="uni-btn subtle"
              onClick={handleUniversalBack}
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <span className="brand-label">SURU STACK</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSyllabusScreen && (
            <SyllabusViewToggle
              isMountainMode={mountainSyllabusMode}
              onToggle={() => {
                setMountainSyllabusMode((prev) => {
                  const next = !prev;
                  if (next) setMountainStage('dots');
                  return next;
                });
              }}
            />
          )}

          {isReadingNotebookPage && (
            <CustomSelect
              className="uni-btn subtle"
              value={currentFont}
              onChange={setCurrentFont}
              options={fonts.map((f) => ({ value: f.value, label: f.name }))}
            />
          )}
        </div>
      </div>

      {screen === 'root_stack' && (
        <SquareStack
          cards={rootCards}
          onSelectItem={handleRootItemSelect}
          onDirectOpenCard={handleRootDirectOpen}
        />
      )}

      {screen === 'my_notes_full' && (
        <MyNotesHub
          subScreen={notesSubScreen}
          setSubScreen={setNotesSubScreen}
          userNotes={userNotes}
          setUserNotes={setUserNotes}
          readerFontSize={readerFontSize}
          immersiveNotes={immersiveNotes}
          setImmersiveNotes={setImmersiveNotes}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {isSyllabusScreen && mountainSyllabusMode ? (
        <MountainSyllabusView
          stage={mountainStage}
          setStage={setMountainStage}
          topics={topicPool}
          activeTopic={activeTopic || topicPool[0]}
          onSelectTopic={(t) => setActiveTopic(t)}
          currentMode={currentMode}
          onToggleMode={() => {
            const nextIdx = (modesOrder.indexOf(currentMode) + 1) % modesOrder.length;
            setCurrentMode(modesOrder[nextIdx]);
          }}
          allModeData={allModeData}
          simpleData={simpleData}
          immersiveNotes={immersiveNotes}
          setImmersiveNotes={setImmersiveNotes}
          readerFontSize={readerFontSize}
          setReaderFontSize={setReaderFontSize}
        />
      ) : (
        <>
          {screen === 'semester_stack' && (
            <SquareStack
              deckTitle="SELECT SEMESTER"
              cards={semesterCards}
              onSelectItem={handleSemesterDirectOpen}
              onDirectOpenCard={handleSemesterDirectOpen}
            />
          )}

          {screen === 'subject_stack' && (
            <SquareStack
              deckTitle={activeSemObj.title}
              cards={subjectCards}
              onSelectItem={handleSubjectTopicSelect}
            />
          )}

          {screen === 'topic_full' && activeTopic && (
            <div
              className="full-page-container"
              onDoubleClick={() => setImmersiveNotes((prev) => !prev)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ fontSize: `${readerFontSize}rem` }}
            >
              <div className="full-page-header-row">
                <div>
                  <h1 className="full-page-title">{activeTopic.title}</h1>
                  {!immersiveNotes && (
                    <p className="full-page-sub">{activeTopic.subtitle}</p>
                  )}
                </div>

                <div className="subtle-mode-wrap">
                  <button
                    className="uni-btn subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextIdx = (modesOrder.indexOf(currentMode) + 1) % modesOrder.length;
                      setCurrentMode(modesOrder[nextIdx]);
                    }}
                  >
                    {currentMode}
                  </button>
                </div>
              </div>

              <NotebookPage
                topicId={activeTopic.id}
                topicData={activeModePayload}
                hasNextTopic={hasNextTopic}
                hasPrevTopic={hasPrevTopic}
                onNextTopic={handleNextTopic}
                onPrevTopic={handlePrevTopic}
              />
            </div>
          )}
        </>
      )}

      {screen === 'gym_full' && (
        <div className="full-page-container">
          <GymView gymData={gymData} setGymData={setGymData} />
        </div>
      )}

      {screen === 'tasks_full' && (
        <div className="full-page-container">
          <Task />
        </div>
      )}

      {screen === 'comp_full' && activeTopic && (
        <div className="full-page-container">
          <Competition
            topicTitle={activeTopic.title}
            modeData={activeModePayload}
            modeName={currentMode}
            onClose={() => setScreen('root_stack')}
            onUpdateScore={(entity, pts) =>
              setScores((prev) => ({
                ...prev,
                [entity]: Math.min(Math.max(prev[entity] + pts, 0), 100)
              }))
            }
          />
        </div>
      )}
    </div>
  );
}
