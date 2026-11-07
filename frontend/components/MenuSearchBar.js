// components/MenuSearchBar.js
import React from 'react';

export default function MenuSearchBar({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategorySelect,
  categories,
  categoryCounts = {},
}) {
  return (
    <div className="zomato-search-wrapper">
      {/* Search Input Bar */}
      <div className="search-input-box">
        <svg
          className="search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search dishes in English, हिंदी, मराठी..."
          aria-label="Search dishes in English, Hindi, or Marathi"
          className="search-input-field"
        />

        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="search-clear-btn"
            aria-label="Clear search"
          >
            ✕
          </button>
        ) : (
          <div className="search-lang-pill" title="Search in English, Hindi (हिंदी), and Marathi (मराठी)">
            EN • हिं • म
          </div>
        )}
      </div>

      {/* Category Horizontal Scroll Row */}
      <div className="menu-filter-bar">
        <div className="category-scroll-strip" role="tablist" aria-label="Menu categories">
          {categories.map((cat) => {
            const count = categoryCounts[cat];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onCategorySelect(cat)}
                className={`filter-chip category-chip ${isActive ? 'active' : ''}`}
              >
                <span>{cat}</span>
                {typeof count === 'number' && (
                  <span className={`chip-count ${isActive ? 'active-count' : ''}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
