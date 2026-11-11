import React, { useState } from 'react';
import { ARTICLES, LearnArticle } from './articles.js';
import { DiagramComponent } from './DiagramComponent.js';
import { ChevronDown, ChevronUp, Play, BookOpen } from 'lucide-react';

interface LearnSectionProps {
  onTriggerAction: (action: LearnArticle['actionTrigger']) => void;
}

export const LearnSection: React.FC<LearnSectionProps> = ({ onTriggerAction }) => {
  const [collapsedArticles, setCollapsedArticles] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) => {
    setCollapsedArticles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const scrollToArticle = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="learn-section-layout" role="region" aria-label="Operating Systems Concurrency Documentation">
      {/* Sticky Table of Contents Sidebar */}
      <aside className="learn-toc-sidebar" aria-label="Table of Contents">
        <div className="toc-card">
          <div className="toc-header">
            <BookOpen size={16} />
            <h3>Topics Overview</h3>
          </div>
          <nav className="toc-nav">
            <ul>
              {ARTICLES.map((art) => (
                <li key={art.id}>
                  <button
                    className="toc-link-btn"
                    onClick={() => scrollToArticle(art.id)}
                  >
                    <span className="toc-badge">{art.badge}</span>
                    <span className="toc-text">{art.title.split(':')[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Main Articles Stream */}
      <main className="learn-articles-stream">
        <div className="learn-intro-banner">
          <h2>How the Parlour Works: Operating Systems Deep Dive</h2>
          <p>
            An interactive textbook companion for CSC-251L. Learn how threads, mutexes, condition variables,
            and bounded queues work under the hood in C on Linux.
          </p>
        </div>

        {ARTICLES.map((article) => {
          const isCollapsed = !!collapsedArticles[article.id];

          return (
            <article
              key={article.id}
              id={article.id}
              className="article-card card"
              aria-labelledby={`heading-${article.id}`}
            >
              {/* Card Header */}
              <div
                className="article-header"
                onClick={() => toggleCollapse(article.id)}
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
              >
                <div className="article-header-text">
                  <span className="article-badge">{article.badge}</span>
                  <h3 id={`heading-${article.id}`}>{article.title}</h3>
                  <p className="article-summary">{article.summary}</p>
                </div>
                <div className="article-header-actions">
                  <button className="collapse-btn" aria-label="Toggle article visibility">
                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </button>
                </div>
              </div>

              {/* Collapsible Content */}
              {!isCollapsed && (
                <div className="article-body">
                  {/* Plain English explanation */}
                  <div className="article-section">
                    <h4>Concept Explanation</h4>
                    <p>{article.plainEnglish}</p>
                  </div>

                  {/* Visual Diagram */}
                  <div className="article-section">
                    <h4>Architecture &amp; Flow Diagram</h4>
                    <DiagramComponent type={article.diagramType} />
                  </div>

                  {/* Backend Step-by-Step */}
                  <div className="article-section">
                    <h4>What the C Backend Does</h4>
                    <pre className="walkthrough-pre">{article.backendWalkthrough}</pre>
                  </div>

                  {/* C Code Snippet */}
                  <div className="article-section">
                    <h4>C Implementation (POSIX Threads &amp; Mutex)</h4>
                    <div className="code-snippet-box">
                      <div className="code-snippet-header">C11 POSIX Threads (/src/booking.c)</div>
                      <pre><code>{article.cCodeSnippet}</code></pre>
                    </div>
                  </div>

                  {/* Interactive "Try it" Action Button */}
                  {article.actionTrigger && (
                    <div className="article-action-footer">
                      <button
                        className="btn-try-action"
                        onClick={() => onTriggerAction(article.actionTrigger)}
                        data-testid={`btn-try-${article.id}`}
                      >
                        <Play size={14} fill="currentColor" />
                        <span>{article.actionLabel || 'Try it in Dashboard'}</span>
                      </button>
                      <span className="action-hint">Jumps to the parlour and fires this exact scenario</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
};

