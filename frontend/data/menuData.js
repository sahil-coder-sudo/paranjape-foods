// data/menuData.js
// Enhanced menu items with photos, ratings, dietary indicators, and multilingual search terms (English, Hindi, Marathi)

export const MENU_ITEMS = [
  {
    _id: 'm1',
    title: 'Avocado Toast',
    description: 'Toasted artisan sourdough, smashed Hass avocado, organic microgreens, chili flakes, extra virgin olive oil',
    price: 14,
    category: 'Breakfast',
    isVeg: true,
    rating: 4.8,
    reviews: 142,
    isBestseller: true,
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'avocado', 'toast', 'sourdough', 'bread', 'breakfast', 'greens', 'olive oil',
      // Hindi (हिंदी & Hinglish)
      'एवोकैडो टोस्ट', 'एवोकैडो', 'टोस्ट', 'नाश्ता', 'ब्रेड', 'मक्खन', 'nashta', 'makkhan', 'avocado toast',
      // Marathi (मराठी & Maranglish)
      'अ‍ॅव्होकॅडो टोस्ट', 'टोस्ट', 'अ‍ॅव्होकॅडो', 'सकाळचा नाश्ता', 'पाव', 'sakalcha nashta', 'pav'
    ]
  },
  {
    _id: 'm2',
    title: 'Lemon Ricotta Pancakes',
    description: 'Fluffy golden buttermilk pancakes, zesty lemon curd, whipped ricotta, and seasonal organic berries',
    price: 16,
    category: 'Breakfast',
    isVeg: true,
    rating: 4.9,
    reviews: 198,
    isBestseller: true,
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'lemon', 'ricotta', 'pancake', 'pancakes', 'berries', 'fluffy', 'breakfast', 'sweet', 'syrup',
      // Hindi (हिंदी & Hinglish)
      'पैनकेक', 'नींबू', 'मलाई', 'मीठा', 'पैनकेक्स', 'नाश्ता', 'pancake', 'pancakes', 'meetha', 'mitha',
      // Marathi (मराठी & Maranglish)
      'पॅनकेक', 'लिंबू', 'मलाई', 'गोड', 'सकाळचा खाऊ', 'पॅनकेक्स', 'god', 'pan cake'
    ]
  },
  {
    _id: 'm3',
    title: 'Granola Bowl',
    description: 'Creamy Greek yogurt, house-toasted maple granola, wildflower honey, chia seeds, and fresh seasonal fruit',
    price: 12,
    category: 'Breakfast',
    isVeg: true,
    rating: 4.6,
    reviews: 87,
    isBestseller: false,
    image: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'granola', 'bowl', 'yogurt', 'curd', 'fruit', 'honey', 'healthy', 'breakfast', 'chia', 'nuts',
      // Hindi (हिंदी & Hinglish)
      'ग्रेनोला', 'दही', 'फल', 'फ्रूट बाउल', 'शहद', 'पौष्टिक', 'नाश्ता', 'dahi', 'phal', 'shahad',
      // Marathi (मराठी & Maranglish)
      'ग्रेनोला वाटी', 'दही', 'फळे', 'मध', 'पौष्टिक नाश्ता', 'dahi', 'fale', 'madh'
    ]
  },
  {
    _id: 'm4',
    title: 'Smoked Turkey Club',
    description: 'Smoked spiced plant-based club, heirloom tomatoes, butter lettuce, and herb aioli on toasted brioche',
    price: 18,
    category: 'Sandwiches',
    isVeg: true,
    rating: 4.8,
    reviews: 165,
    isBestseller: true,
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'smoked', 'club', 'sandwich', 'bread', 'veg', 'lunch',
      // Hindi (हिंदी & Hinglish)
      'सैंडविच', 'क्लब सैंडविच', 'वेज सैंडविच', 'ब्रेड', 'sandwich', 'veg',
      // Marathi (मराठी & Maranglish)
      'सँडविच', 'पाव', 'क्लब सँडविच', 'शाकाहारी', 'sandwich', 'pav', 'shakahari'
    ]
  },
  {
    _id: 'm5',
    title: 'Spicy Falafel Wrap',
    description: 'Crispy herb falafels, sesame tahini, pickled wild cucumbers, shredded red cabbage, and harissa chili spread',
    price: 15,
    category: 'Sandwiches',
    isVeg: true,
    rating: 4.7,
    reviews: 112,
    isBestseller: false,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'spicy', 'falafel', 'wrap', 'roll', 'tahini', 'harissa', 'chili', 'sandwich', 'middle eastern',
      // Hindi (हिंदी & Hinglish)
      'फालाफेल रैप', 'रैप', 'रोल', 'तीखा', 'मसालेदार', 'फालाफेल', 'tikha', 'masaledar', 'wrap', 'roll',
      // Marathi (मराठी & Maranglish)
      'फालाफेल रॅप', 'रॅप', 'रोल', 'तिखट', 'मसालेदार', 'tikhat', 'masaledar', 'roll'
    ]
  },
  {
    _id: 'm6',
    title: 'Grilled Chicken Panini',
    description: 'Grilled spiced paneer, fragrant basil pine-nut pesto, melted provolone cheese, and sun-dried tomatoes',
    price: 17,
    category: 'Sandwiches',
    isVeg: true,
    rating: 4.8,
    reviews: 174,
    isBestseller: true,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'panini', 'grilled', 'pesto', 'cheese', 'sandwich', 'veg', 'provolone', 'paneer',
      // Hindi (हिंदी & Hinglish)
      'पाणिनी', 'पनीर', 'ग्रिल्ड', 'चीज', 'सैंडविच', 'panini', 'cheese', 'paneer',
      // Marathi (मराठी & Maranglish)
      'पाणिनी', 'पनीर', 'भाजलेले पनीर', 'चीझ', 'सँडविच', 'panini', 'shakahari'
    ]
  },
  {
    _id: 'm7',
    title: 'Kale Caesar',
    description: 'Crisp Tuscan kale, aged parmesan shavings, hand-torn garlic sourdough croutons, and creamy caper dressing',
    price: 13,
    category: 'Salads & Bowls',
    isVeg: true,
    rating: 4.5,
    reviews: 95,
    isBestseller: false,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'kale', 'caesar', 'salad', 'parmesan', 'croutons', 'healthy', 'greens', 'bowl',
      // Hindi (हिंदी & Hinglish)
      'केल सीज़र सलाद', 'सलाद', 'पत्ता गोभी', 'हरा सलाद', 'पौष्टिक', 'salad', 'hari sabzi',
      // Marathi (मराठी & Maranglish)
      'सॅलड', 'कोशिंबीर', 'हिरवे सॅलड', 'पालेभाजी', 'पौष्टिक', 'salad', 'koshimbir'
    ]
  },
  {
    _id: 'm8',
    title: 'Roasted Beet Salad',
    description: 'Slow-roasted red and golden beets, whipped creamy goat cheese, candied pecans, and blood orange vinaigrette',
    price: 14,
    category: 'Salads & Bowls',
    isVeg: true,
    rating: 4.7,
    reviews: 104,
    isBestseller: false,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'roasted', 'beet', 'beetroot', 'salad', 'goat cheese', 'pecans', 'healthy', 'orange',
      // Hindi (हिंदी & Hinglish)
      'चुकंदर सलाद', 'चुकंदर', 'सलाद', 'बीट', 'पनीर', 'chukandar', 'beet', 'salad',
      // Marathi (मराठी & Maranglish)
      'बीट कोशिंबीर', 'बीट', 'सॅलड', 'कोशिंबीर', 'beet', 'koshimbir', 'salad'
    ]
  },
  {
    _id: 'm9',
    title: 'Quinoa Harvest Bowl',
    description: 'Tri-color quinoa, maple-roasted sweet potato, charred broccolini, creamy avocado, and toasted sesame tahini',
    price: 16,
    category: 'Salads & Bowls',
    isVeg: true,
    rating: 4.9,
    reviews: 183,
    isBestseller: true,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'quinoa', 'harvest', 'bowl', 'sweet potato', 'avocado', 'healthy', 'vegan', 'superfood',
      // Hindi (हिंदी & Hinglish)
      'क्विनोआ बाउल', 'क्विनोआ', 'अनाज', 'शकरकंद', 'पौष्टिक बाउल', 'paushtik', 'quinoa', 'healthy',
      // Marathi (मराठी & Maranglish)
      'क्विनोआ वाटी', 'क्विनोआ', 'पौष्टिक जेवण', 'धान्य', 'रताळे', 'paushtik', 'jevan'
    ]
  },
  {
    _id: 'm10',
    title: 'Chocolate Tart',
    description: 'Silky 70% dark Belgian chocolate ganache, crisp hazelnut cocoa crust, sea salt flakes, and vanilla crème fraîche',
    price: 9,
    category: 'Sweet treats',
    isVeg: true,
    rating: 4.9,
    reviews: 215,
    isBestseller: true,
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'chocolate', 'tart', 'dark chocolate', 'dessert', 'sweet', 'pastry', 'cake', 'cocoa',
      // Hindi (हिंदी & Hinglish)
      'चॉकलेट टार्ट', 'चॉकलेट', 'टार्ट', 'मीठा', 'मिठाई', 'पेस्ट्री', 'chocolate', 'meetha', 'mithai',
      // Marathi (मराठी & Maranglish)
      'चॉकलेट टार्ट', 'चॉकलेट', 'गोड', 'मिठाई', 'केक', 'god', 'mithai', 'chocolate'
    ]
  },
  {
    _id: 'm11',
    title: 'Berry Crumble',
    description: 'Warm bubbling blackberries, raspberries and blueberries topped with crisp brown sugar oat crumble and cinnamon',
    price: 10,
    category: 'Sweet treats',
    isVeg: true,
    rating: 4.7,
    reviews: 129,
    isBestseller: false,
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'berry', 'crumble', 'blueberries', 'dessert', 'sweet', 'oat', 'pie', 'baked',
      // Hindi (हिंदी & Hinglish)
      'बेरी क्रम्बल', 'बेरी', 'मीठा', 'केक', 'पाई', 'फल मिठाई', 'sweet', 'cake', 'meetha',
      // Marathi (मराठी & Maranglish)
      'बेरी क्रम्बल', 'बेरी', 'गोड', 'केक', 'मिठाई', 'god', 'cake', 'mithai'
    ]
  },
  {
    _id: 'm12',
    title: 'Espresso Affogato',
    description: 'Scoop of authentic Tahitian vanilla bean gelato drowned in a freshly pulled double shot of dark roast espresso',
    price: 8,
    category: 'Sweet treats',
    isVeg: true,
    rating: 4.8,
    reviews: 145,
    isBestseller: true,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    tags: [
      // English
      'espresso', 'affogato', 'coffee', 'ice cream', 'gelato', 'vanilla', 'beverage', 'dessert',
      // Hindi (हिंदी & Hinglish)
      'एस्प्रेसो', 'कॉफी', 'आइसक्रीम', 'मीठा पेय', 'affogato', 'coffee', 'ice cream', 'meetha',
      // Marathi (मराठी & Maranglish)
      'कॉफी', 'एस्प्रेसो', 'आईस्क्रीम', 'गोड पेय', 'coffee', 'ice cream', 'god'
    ]
  }
];

export const CATEGORIES = ['All', 'Breakfast', 'Sandwiches', 'Salads & Bowls', 'Sweet treats'];
