# StartingLine - Fitness Events Calendar

A modern fitness events calendar website where users can discover and explore fitness events in their area.

## Features

- **Event Discovery**: Browse fitness events with detailed information including date, time, location, and pricing
- **Smart Filtering**: Filter events by type (Running, Yoga, Cycling, HIIT, Swimming, etc.), location, and date
- **Popular Now**: See trending events based on popularity
- **Calendar View**: Select specific dates to find events
- **Location Search**: Search for events in specific cities or areas
- **Responsive Design**: Fully responsive across mobile, tablet, and desktop devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Color Scheme

| Color       | Hex       | Usage                            |
|-------------|-----------|----------------------------------|
| Lime Green  | `#A6E22E` | Primary accent, CTAs, highlights |
| Dark Gray   | `#1F1F1F` | Backgrounds, text                |
| Light Gray  | `#F5F7FA` | Page background, cards           |
| Medium Gray | `#8A8F98` | Secondary text, borders          |

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
startingline/
├── app/
│   ├── layout.tsx          # Root layout with Header/Footer
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles + CSS variables
│   └── events/
│       └── page.tsx        # Events listing with filters
├── components/
│   ├── Header.tsx          # Navigation bar
│   ├── Footer.tsx          # Site footer
│   ├── Hero.tsx            # Hero section with search
│   ├── CalendarPicker.tsx  # Date selection widget
│   ├── FilterSidebar.tsx   # Event type + location filters
│   ├── EventCard.tsx       # Individual event display
│   ├── EventList.tsx       # Grid of event cards
│   └── PopularNow.tsx      # Trending events section
├── data/
│   └── events.json         # Sample fitness events data
├── types/
│   └── index.ts            # TypeScript interfaces
├── lib/
│   └── utils.ts            # Helper functions
└── public/
    └── images/             # Image assets (placeholder)
```

## Event Types

- Running / Marathons
- Yoga / Pilates
- Cycling
- HIIT / CrossFit
- Swimming
- Group Fitness Classes
- Outdoor Adventures
- Sports Leagues

## Adding Your Own Events

Edit `data/events.json` to add or modify events. Each event should follow this structure:

```json
{
  "id": "unique-id",
  "title": "Event Title",
  "description": "Event description...",
  "date": "2026-02-15",
  "time": "07:00",
  "endTime": "08:30",
  "location": "Venue Name, City",
  "area": "City Name",
  "type": "yoga",
  "image": "/images/event.jpg",
  "popularity": 95,
  "price": "Free",
  "organizer": "Organizer Name",
  "capacity": 50,
  "spotsLeft": 12
}
```

## License

MIT
