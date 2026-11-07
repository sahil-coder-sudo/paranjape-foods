export default function MenuCategoryCard({
  category,
  items,
  isExpanded,
  onToggle,
  cart = [],
  onUpdateQuantity,
}) {
  return (
    <div className={`menu-category-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <button
        type="button"
        className="menu-category-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${category} menu`}
      >
        <div className="menu-category-title-wrap">
          <h3 className="menu-category-title">{category}</h3>
          <span className="menu-category-badge">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="expand-button" aria-hidden="true">
          <svg
            className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="menu-subcategory-list" role="region" aria-label={`${category} items`}>
          {items.map((item) => {
            const currentQty =
              cart.find((c) => c.menuItemId === item._id)?.quantity || 0;

            const numericPrice =
              typeof item.price === 'number'
                ? item.price
                : Number(String(item.price).replace(/[^0-9.]/g, '')) || 0;

            return (
              <div
                key={item._id}
                className={`menu-item-row-card ${currentQty > 0 ? 'has-qty' : ''}`}
              >
                <div className="item-info">
                  <span className="item-name">{item.title}</span>
                  {item.description && (
                    <span className="item-description-tag" title={item.description}>
                      {item.description}
                    </span>
                  )}
                </div>

                <div className="item-actions">
                  <span className="item-price">₹{numericPrice}</span>
                  <div className="item-controls">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.title}`}
                      disabled={currentQty === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item, -1);
                      }}
                      className="control-btn minus"
                    >
                      −
                    </button>
                    <span className="control-qty">{currentQty}</span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item, 1);
                      }}
                      className="control-btn plus"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
