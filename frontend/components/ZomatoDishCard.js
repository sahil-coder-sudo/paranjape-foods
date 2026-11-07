// components/ZomatoDishCard.js
import React from 'react';

export default function ZomatoDishCard({
  item,
  currentQty = 0,
  onUpdateQuantity,
}) {
  const numericPrice =
    typeof item.price === 'number'
      ? item.price
      : Number(String(item.price).replace(/[^0-9.]/g, '')) || 0;

  return (
    <article className={`zomato-dish-card ${currentQty > 0 ? 'in-cart' : ''}`}>
      {/* Left Column: Details */}
      <div className="dish-details-col">
        {/* Badges Row: Veg/Non-Veg icon + Bestseller / Rating */}
        <div className="dish-meta-row">
          <span
            className={`dietary-symbol ${item.isVeg ? 'veg' : 'non-veg'}`}
            title={item.isVeg ? 'Pure Vegetarian' : 'Non-Vegetarian'}
            aria-label={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
          >
            <span className="dietary-inner" />
          </span>

          {item.isBestseller && (
            <span className="bestseller-badge">
              <span className="bestseller-star">★</span> Bestseller
            </span>
          )}

          {item.rating && (
            <span className="rating-pill">
              ★ {item.rating}
              {item.reviews && <span className="rating-count">({item.reviews})</span>}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="zomato-dish-title">{item.title}</h3>

        {/* Price */}
        <div className="zomato-dish-price">
          <span className="currency-symbol">₹</span>
          <span className="price-num">{numericPrice}</span>
        </div>

        {/* Description */}
        {item.description && (
          <p className="zomato-dish-desc">{item.description}</p>
        )}
      </div>

      {/* Right Column: Visual Thumbnail & Floating ADD Stepper */}
      <div className="dish-media-col">
        <div className="dish-image-wrapper">
          <img
            src={item.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=400&q=80'}
            alt={item.title}
            className="dish-thumbnail"
            loading="lazy"
          />

          {/* Floating ADD Button / Stepper Component */}
          <div className="zomato-add-container">
            {currentQty > 0 ? (
              <div className="zomato-stepper">
                <button
                  type="button"
                  className="stepper-btn minus"
                  aria-label={`Decrease ${item.title} quantity`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(item, -1);
                  }}
                >
                  −
                </button>
                <span className="stepper-count">{currentQty}</span>
                <button
                  type="button"
                  className="stepper-btn plus"
                  aria-label={`Increase ${item.title} quantity`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(item, 1);
                  }}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="zomato-add-btn"
                aria-label={`Add ${item.title} to cart`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity(item, 1);
                }}
              >
                <span>ADD</span>
                <span className="add-plus-icon">+</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
