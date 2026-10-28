// FILE: src/data/data_cards.js
import React from 'react';
import { PenTool, BookOpen, Dumbbell, CheckSquare, Swords, User } from 'lucide-react';

export const getRootCards = (userNotesCount, todayLog, activeSemesterBadge, activeArenaTopics, scoresUser) => [

  {
    id: 'card_suru_notes',
    title: 'Syllabus',
    badge: 'SEM 1-5',
    theme: 'shade-3',
    icon: <BookOpen size={20} color="#e5e5e5" />,
    subtitle: 'Reference Library',
    description: 'Browse semester subjects and clinical reference chapters.',
    directOpen: true
  }, 
  {
    id: 'card_my_notes',
    title: 'My Notes',
    badge: 'STUDIO',
    theme: 'shade-2',
    icon: <PenTool size={20} color="#e5e5e5" />,
    subtitle: 'Personal & AI Stacks',
    description: 'Generate study decks, import books or PDFs, and organize chapters.',
    directOpen: true
  },
  {
    id: 'card_gym',
    title: 'GYM',
    badge: 'SESSION',
    theme: 'shade-4',
    icon: <Dumbbell size={20} color="#e5e5e5" />,
    subtitle: todayLog ? `${todayLog.split} • Logged` : 'Log Today’s Session',
    description: 'Real-time workout sets, rest timer, body metrics, and 7-day volume graph.',
    directOpen: true
  },
  {
    id: 'card_tasks',
    title: 'Tasks',
    badge: 'TODO',
    theme: 'shade-1',
    icon: <CheckSquare size={20} color="#e5e5e5" />,
    subtitle: 'Directives & Timers',
    description: 'Custom tasks with live countdown timers, categories, and completion ticks.',
    directOpen: true
  },
  {
    id: 'card_arena',
    title: 'Trials',
    badge: `${scoresUser}%`,
    theme: 'shade-2',
    icon: <Swords size={20} color="#e5e5e5" />,
    subtitle: `${activeSemesterBadge} Simulations`,
    description: 'Clinical scenarios and MCQ evaluation for the active semester.',
    items: activeArenaTopics.map((t) => ({
      id: `trial_${t.id}`,
      title: t.title,
      subtitle: t.subtitle,
      topicObj: t
    }))
  },
  {
    id: 'card_profile',
    title: 'Omkar R',
    badge: 'CREATOR',
    theme: 'shade-1',
    icon: <User size={20} color="#e5e5e5" />,
    subtitle: 'Arcadevibes09@gmail.com',
    description: "Built with Suru OS architecture.",
    directOpen: false
  },
];
