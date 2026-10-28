// FILE: src/components/SquareStack.jsx
import React, { useState, useRef } from 'react';
import { ArrowUpRight, X, Trash2 } from 'lucide-react';
import GlitchCatMini from './mountain/GlitchCatMini';

const ONBOARDING_KEY = 'suru_gesture_onboarded_v1';

export default function SquareStack({
  cards = [],
  deckTitle,
  onSelectItem,
  onDirectOpenCard,
  onLongPressStack,
  onDeleteCard,
  onDeleteItem
}) {
  const [frontIndex, setFrontIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState('3d');
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_KEY);
    } catch {
      return false;
    }
  });

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const isScrolling = useRef(false);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    clearLongPress();
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!isScrolling.current && onLongPressStack) {
        longPressTriggered.current = true;
        if (navigator.vibrate) navigator.vibrate(25);
        onLongPressStack();
      }
    }, 480);
  };

  const handleTouchStart = (e) => {
    if (expandedCardId) return;
    isScrolling.current = false;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    };
    startLongPress();
  };

  const handleTouchMove = (e) => {
    if (expandedCardId) return;
    const dy = Math.abs(e.targetTouches[0].clientY - touchStart.current.y);
    const dx = Math.abs(e.targetTouches[0].clientX - touchStart.current.x);

    if (dy > 10 || dx > 10) {
      isScrolling.current = true;
      clearLongPress();
    }
  };

  const handleTouchEnd = (e) => {
    clearLongPress();
    if (expandedCardId || longPressTriggered.current) return;

    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    const dt = Date.now() - touchStart.current.time;
    const isFastSwipe = dt < 360;

    if (layoutMode === '3d' && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 42) {
      if (dx > 0) {
        setFrontIndex((prev) => (prev + 1) % cards.length);
      } else {
        setFrontIndex((prev) => (prev - 1 + cards.length) % cards.length);
      }
      return;
    }

    if (layoutMode === '3d' && dy < -65 && isFastSwipe) {
      setLayoutMode('b2');
      return;
    }

    const isAtTop = window.scrollY <= 4;
    if (layoutMode === 'b2' && dy > 85 && isFastSwipe && isAtTop) {
      setLayoutMode('3d');
    }
  };

  const handleSquareClick = (e, card, index) => {
    e.stopPropagation();
    if (isScrolling.current || longPressTriggered.current) return;
    if (expandedCardId === card.id) return;

    if (layoutMode === '3d' && index !== frontIndex) {
      setFrontIndex(index);
      return;
    }

    if (card.directOpen && onDirectOpenCard) {
      onDirectOpenCard(card);
      return;
    }

    setExpandedCardId(card.id);
  };

  const getRelativePosition = (index) => {
    const diff = (index - frontIndex + cards.length) % cards.length;
    if (diff === 0) return 'pos-0';
    if (diff === 1) return 'pos-1';
    if (diff === 2) return 'pos-2';
    return 'pos-hidden';
  };

  const expandedCard = cards.find((c) => c.id === expandedCardId);

  return (
    <div
      className={`stack-viewport ${layoutMode === 'b2' ? 'is-b2-active' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={() => !expandedCardId && startLongPress()}
      onMouseUp={clearLongPress}
      onMouseLeave={clearLongPress}
      onClick={() => {
        if (expandedCardId && !isScrolling.current && !longPressTriggered.current) {
          setExpandedCardId(null);
        }
      }}
    >
      {/* First-Time Gesture Onboarding Overlay */}
      {showOnboarding && (
        <div className="sq-onboard-overlay" onClick={dismissOnboarding}>
          <div className="sq-onboard-box" onClick={(e) => e.stopPropagation()}>
            <div className="sq-onboard-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GlitchCatMini state="speaking" size={26} />
                <span>SURU OS GUIDE</span>
              </div>
              <button className="sq-onboard-close" onClick={dismissOnboarding}>
                <X size={16} />
              </button>
            </div>
            <ul className="sq-onboard-list">
              <li>👉 <strong>Swipe Left / Right:</strong> Rotate through stack cards</li>
              <li>👇 <strong>Swipe Down:</strong> Toggle unstacked grid view</li>
              <li>👆 <strong>Tap Card:</strong> Open studio or reference library</li>
            </ul>
            <button className="uni-btn subtle active sq-onboard-btn" onClick={dismissOnboarding}>
              Got it, let's begin 🤍
            </button>
          </div>
        </div>
      )}

      {deckTitle && !expandedCard && (
        <p className="sq-deck-overline">{deckTitle}</p>
      )}

      {expandedCard ? (
        <div
          className="stack-Deck expanded-view"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="stack-square is-expanded">
            <div className="sq-header">
              <div className="sq-title-wrap">
                <span className="sq-icon-Well">{expandedCard.icon}</span>
                <h2 className="sq-title">{expandedCard.title}</h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {expandedCard.badge && (
                  <span className="sq-pill-badge">{expandedCard.badge}</span>
                )}
                {onDeleteCard && expandedCard.id !== 'deck_personal_saved' && (
                  <button
                    type="button"
                    className="uni-btn subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCard(expandedCard.id);
                      setExpandedCardId(null);
                      setFrontIndex(0);
                    }}
                    title="Delete Stack"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div
              className="expanded-list-container"
              onTouchStart={(e) => e.stopPropagation()}
            >
              {expandedCard.items?.map((item) => (
                <div
                  key={item.id}
                  className="expanded-list-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectItem(expandedCard, item);
                  }}
                >
                  <div className="expanded-item-top">
                    <div className="expanded-item-title">{item.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {onDeleteItem && (
                        <button
                          type="button"
                          className="uni-btn subtle"
                          style={{ padding: '4px 7px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(expandedCard, item);
                          }}
                          title="Delete Chapter"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <ArrowUpRight size={14} color="#555" />
                    </div>
                  </div>
                  {item.subtitle && (
                    <div className="expanded-item-sub">{item.subtitle}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={`stack-Deck ${layoutMode === 'b2' ? 'b2-grid' : 'stacked-3d'}`}>
          {layoutMode === '3d' && cards.length > 1 && (
            <>
              <div className="sq-ghost-plate plate-back-2" aria-hidden="true" />
              <div className="sq-ghost-plate plate-back-1" aria-hidden="true" />
            </>
          )}

          {cards.map((card, index) => (
            <div
              key={card.id}
              className={`stack-square ${card.theme || ''} ${
                layoutMode === 'b2' ? 'b2-squircle-card' : getRelativePosition(index)
              }`}
              onClick={(e) => handleSquareClick(e, card, index)}
            >
              <div className="sq-header">
                <div className="sq-title-wrap">
                  <span className="sq-icon-Well">
                    {card.id === 'card_profile' ? (
                      <GlitchCatMini state="curiosity" size={24} />
                    ) : (
                      card.icon
                    )}
                  </span>
                  <h2 className="sq-title">{card.title}</h2>
                </div>
                {card.badge && (
                  <span className="sq-pill-badge">{card.badge}</span>
                )}
              </div>

              <div className="sq-inner-well">
                <div className="sq-day-row">
                  <p className="sq-day">{card.subtitle}</p>
                  <ArrowUpRight size={14} className="sq-corner-arrow" />
                </div>
                <p className="sq-desc">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
