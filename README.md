# StartingLine

Australia's competitive fitness event discovery platform.

## Overview

StartingLine helps performance-driven fitness individuals discover competitive events across Australia. Find HYROX, CrossFit competitions, running races, and hybrid fitness events in one place.

## Features

- **Event Discovery**: Browse upcoming competitions sorted by date
- **Smart Filtering**: Filter by event type, state, date range, and format (individual/team)
- **Australia-Wide Coverage**: Events across NSW, VIC, QLD, WA, SA, TAS, ACT, NT
- **Direct Registration**: Links directly to official event registration pages
- **Dark Theme**: Clean, athletic design optimized for serious competitors

## Event Types

- **HYROX** - The World Series of Fitness Racing
- **CrossFit** - CrossFit competitions and throwdowns
- **Running** - 5K to marathon distance races
- **Hybrid** - Functional fitness and obstacle course events

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Project Structure

```
startingline/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── events/
│       └── page.tsx     # Events listing
├── components/
│   ├── Header.tsx       # Navigation
│   ├── Footer.tsx       # Footer
│   ├── Hero.tsx         # Hero section
│   ├── FilterSidebar.tsx # Filters
│   ├── EventCard.tsx    # Event cards
│   └── EventList.tsx    # Event grid/list
├── data/
│   └── events.json      # Event data
├── types/
│   └── index.ts         # TypeScript types
└── lib/
    └── utils.ts         # Helper functions
```

## Adding Events

Edit `data/events.json` to add competitions:

```json
{
  "id": "unique-id",
  "title": "Event Name",
  "description": "Event description",
  "date": "2026-03-15",
  "time": "07:00",
  "location": "Venue, City",
  "city": "Sydney",
  "state": "nsw",
  "type": "hyrox",
  "format": "both",
  "level": "open",
  "image": "/images/event.jpg",
  "registrationUrl": "https://...",
  "organizer": "Organizer Name",
  "isOfficial": true
}
```

## License

MIT
