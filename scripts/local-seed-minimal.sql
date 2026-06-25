-- Minimal local seed for registration UI testing (no Cognito/AWS required)
-- Matches seed-event-001 from prisma/seed.ts
--
-- After running this SQL, set up Stripe Connect for checkout:
--   pnpm stripe:setup

INSERT INTO users (id, "cognitoSub", email, name, username, "isPublic", "createdAt", "updatedAt")
VALUES (
  'local-user-organiser-001',
  'local-cognito-sub-organiser',
  'organiser@startline.test',
  'Test Organiser',
  'organiser',
  true,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO organisers (
  id, "userId", email, verified, status, "orgName", "contactName", "contactEmail",
  phone, abn, website, instagram, bio, photos,
  "stripeAccountId", "stripeOnboardingComplete", "createdAt", "updatedAt"
)
VALUES (
  'local-organiser-001',
  'local-user-organiser-001',
  'organiser@startline.test',
  true,
  'APPROVED',
  'Apex Endurance Events',
  'Test Organiser',
  'organiser@startline.test',
  '+61 400 000 000',
  '51 824 753 556',
  'https://startlineau.com',
  'apexenduranceevents',
  'Test organiser for development and testing purposes.',
  '{}',
  NULL,
  false,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO events (
  id, "organiserId", status, title, discipline, tagline, description,
  "eventDate", "endDate", "startTime", "endTime", venue, address, city, state,
  format, level, categories, cap, "minAge", waves,
  inclusions, extras, activations, "refundPolicy", "registrationType", "feeStructure",
  "coverImageUrl", "bagDrop", parking, "accessibilityInfo",
  "createdAt", "updatedAt"
)
VALUES (
  'seed-event-001',
  'local-organiser-001',
  'APPROVED',
  'The Apex Throwdown 2026',
  'functional_fitness',
  'Two days. One leaderboard. Every rep counts.',
  'Victoria''s premier functional fitness competition. Three workouts across two days. Scaled, RX, and Elite divisions.',
  '2026-08-15',
  '2026-08-16',
  '07:30',
  '17:00',
  'Melbourne Sports & Aquatic Centre',
  'Albert Road, Albert Park',
  'Melbourne',
  'vic',
  'both',
  'open',
  '["Individual Scaled", "Individual RX", "Individual Elite", "Team of 2"]'::json,
  320,
  16,
  '[{"label":"Early Bird","date":"2026-05-01","price":"95","qty":80},{"label":"General","date":"2026-06-15","price":"115","qty":150},{"label":"Late Entry","date":"2026-07-31","price":"135","qty":90}]'::json,
  'Event t-shirt, finisher medal, post-event party, online score tracking',
  'Spectator tickets $15/day. Parking $12/day.',
  'Vendor expo Friday evening.',
  'Moderate',
  'startline',
  'athlete',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80',
  'Bag drop at Gate 3 from 6:45am.',
  'MSAC car park $12/day.',
  'Wheelchair accessible venue.',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET status = 'APPROVED';
