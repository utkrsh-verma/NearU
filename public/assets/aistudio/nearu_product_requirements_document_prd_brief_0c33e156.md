# NearU — Product Requirements Document (PRD) & Product Brief (V1)

**Product Name:** NearU  
**Tagline & Positioning:** *Real connections. Right around campus.*  
**Target Domain:** Hyperlocal College Dating Web Application  
**Primary Launch Partner:** GL Bajaj Institute of Technology & Management, Greater Noida (`@glbitm.ac.in`)  
**Target Platform:** Mobile-First Web Application (PWA / Responsive Web App) + Independently Optimized Desktop Layout  
**Tech Stack Baseline:** React (Vite) + Tailwind CSS + Supabase (Auth, PostgreSQL, Row Level Security, Realtime)  
**Document Status:** Approved for Engineering & UX Execution (V1 Baseline)  

---

## 1. Executive Summary & Product Vision

### 1.1 Problem Statement
Conventional dating platforms (Tinder, Bumble, Hinge) suffer from significant structural drop-offs in Indian tier-1/tier-2 engineering campuses:
- **Low Hyperlocality & Distance Noise:** Algorithmic radius filtering often spans 20–50 km across Noida/Delhi NCR, pairing students with individuals outside their daily campus routine.
- **Safety & Impersonation Concerns:** Inauthentic profiles, catfishing, and unsolicited harassment undermine trust, particularly among female students.
- **Awkward Campus Dynamics:** Fear of immediate campus gossip, aggressive location sharing, or awkward real-world encounters prevents authentic expression.
- **Superficial "Swipe Culture":** High friction to start meaningful conversations; users get matches but conversations rarely leave the inbox.

### 1.2 The NearU Solution
NearU is a closed-loop, verified hyperlocal college dating platform tailored explicitly for GL Bajaj students. By restricting access to verified institutional email domains, establishing strict anti-creep boundaries (no live GPS tracking, no online status stalkability), and integrating campus-specific shared affinities (departments, favorite canteens, common exams, indie music), NearU transforms casual matching into authentic, safe campus camaraderie and dating.

---

## 2. Target Audience & Personas

### 2.1 Primary Target Audience
- **Age:** 18–24 years old.
- **Eligibility:** Active, enrolled students with a valid `@glbitm.ac.in` college email address (B.Tech, MBA, MCA across batches 2024–2028).
- **Core Needs:** Meeting like-minded peers across different branches/hostels, breaking the ice without awkward overthinking, verified safety, zero spam.

### 2.2 Core Personas

#### Persona A: "The Reluctant Dater" — Ananya (20, B.Tech CSE 3rd Year)
- **Behavior:** Avoids mainstream dating apps due to privacy fears and catfishing. Doesn't want her profile discovered by relatives or outsiders.
- **Needs:** High safety guarantees, verification badge, department/year tags, ability to easily block or unmatch, shared campus cultural context (compiler labs, Nescafe canteen).

#### Persona B: "The Busy Commuter / Hosteler" — Kabir (21, B.Tech IT 3rd Year)
- **Behavior:** Spends entire days shuttling between lectures and labs. Wants to meet people from other blocks or societies (Design Club, Music Society) without cold-approaching in crowded campus lawns.
- **Needs:** Fast, low-friction mobile discovery, authentic bio prompts, instant campus icebreakers that prevent conversation dead-ends.

---

## 3. Product Scope & Version 1 Boundary

To ensure a high-craft, launch-ready experience within scope, NearU V1 enforces strict boundaries.

### In Scope for V1
- **Domain-Restricted Auth:** Google OAuth restricted to `@glbitm.ac.in` with 18+ age verification.
- **Profile Creation & Management:** Name, Age, Branch, Year, Bio, 2 profile photos, 5 interest chips, and "Looking For" intent statement.
- **Curated Campus Discovery:** Single-card sequential deck with Pass (`✕`) and Like (`♥`). Second photo switcher.
- **Mutual Match State:** Celebration screen highlighting shared affinities and pre-populated campus icebreaker buttons.
- **Connections Dashboard:** Horizontal "New Matches" carousel and active conversation list with unread markers.
- **Distraction-Free Private Chat:** 1-on-1 real-time text chat with campus safety warnings, timestamps, read receipts, and Unmatch / Block actions.

### Explicitly Excluded (Out of Scope for V1)
- ❌ **No Paid Memberships / Super-likes:** Completely free for all verified students.
- ❌ **No Live Geolocation Tracking:** Privacy-first; distance is strictly campus-proximity without GPS coordinates.
- ❌ **No Online / Last-Seen Timestamps:** Prevents pressure, harassment, and social surveillance.
- ❌ **No Video or Voice Calling:** Prevents bandwidth and moderation risks in early stage.
- ❌ **No Public Social Feeds or Stories:** Keeps product laser-focused on 1-on-1 mutual connections.
- ❌ **No Complex AI Matching / Algorithmic Ranking:** Discovery queue prioritizes reciprocal interests and active accounts.

---

## 4. Feature Specifications & User Journeys

### 4.1 Authentication & Onboarding Flow
1. **Landing View:** High-conversion welcome page with hero typography ("Someone closer than you think") and GL Bajaj trust cues.
2. **Google OAuth Gateway:** User authenticates via Google. Backend validates regex `^[a-zA-Z0-9._%+-]+@glbitm\.ac\.in$`. Non-domain attempts rejected with a clear campus exclusivity dialog.
3. **Profile Setup Wizard:**
   - **Step 1 (Basic Details):** Full Name, Gender, Date of Birth (calculates 18+ requirement), Branch/Specialization, Batch Year.
   - **Step 2 (Photos):** Upload 2 photos. Drag-and-drop / mobile camera roll selection with aspect-ratio enforcement (3:4 or 4:5 portrait).
   - **Step 3 (Personality & Intent):** Bio (max 180 chars), 3–5 interest tags (e.g., *Indie Rock, Compiler Labs, Coffee Runs, Hackathons*), "Looking For" selection (*Long-term, Study dates, Casual chai & talks*).
   - **Step 4 (Preview & Publish):** Full-screen card preview before entering discovery.

### 4.2 Discovery Deck (Core Engine)
- **Deck Interaction:** Profiles displayed one at a time. Keyboard navigation (Desktop: Left/Right Arrow) and Ergonomic Touch Targets (Mobile: bottom thumb zone).
- **Profile Information Display:**
  - Photo 1 / Photo 2 tap switcher with Instagram-style top dash indicators.
  - Name, Age, Campus Verification Badge (`@glbitm.ac.in Verified`), Branch & Batch tag.
  - Campus micro-location reference (*e.g., "Block 3", "Audi Lawn sketcher"*).
  - Shared interest chips with visual highlighting if matching active user.
- **Actions:**
  - `Pass` (`✕`): Discards profile from active session queue without notification.
  - `Like` (`♥`): Registers interest in database table `swipes`. Triggers mutual match evaluation.

### 4.3 Match Celebration & Icebreakers
- Triggered when two users register mutual `Like` records.
- Overlay modal featuring dual overlapping profile cards and highlighted commonalities (*"You both love Coffee Runs & Indie Rock"*).
- **Frictionless Icebreakers:** 2–3 one-tap suggestion chips (e.g., *"Hey, survive the compiler quiz?"*, *"Chai at Nescafe canteen?"*) that immediately initialize the chat with contextual copy.

### 4.4 Connections & Messaging
- **Connections List:** Divided into "New Matches" (uninitiated chats) and "Conversations" (active message threads).
- **Chat Environment:**
  - Campus Safety Advisory header: *"You are both verified students of GL Bajaj. Never share UPI pins or passwords."*
  - Clean bubble hierarchy: User messages in vibrant rose/coral accent (`#E05A6D` / `#F472B6`), incoming messages in dark elevated surface (`#1A1B20`).
  - Read receipts (`✓✓`) and relative timestamps.
  - Overflow controls:
    - **Unmatch:** Instantly severs connection and purges chat visibility for both parties.
    - **Report & Block:** Flag harassment, inappropriate content, or policy breach; permanently bans direct interaction.

---

## 5. UI/UX Design System & Token Architecture

The user experience follows the **Neo-Editorial Hyperlocal System** (`{{DATA:DESIGN_SYSTEM:DESIGN_SYSTEM_1}}`).

### 5.1 Color Tokens
- **Background / Surfaces:**
  - `surface-container-lowest`: `#0D0E12` (App baseline background)
  - `surface`: `#121317` (Card & navigation base)
  - `surface-container-low`: `#1A1B20` (Elevated chat bubbles & input fields)
  - `surface-container-high`: `#2A2B32` (Interactive hover & borders)
- **Primary Accents:**
  - Primary Rose Accent: `#F472B6` / `#E05A6D`
  - Glow & Ambient Shadows: `rgba(244, 114, 182, 0.18)`
- **Typography & States:**
  - Primary Text: Soft off-white `#F3F4F6` (high contrast, zero harsh eye strain)
  - Muted Text / Labels: Neutral gray `#9CA3AF`
  - Verification Badge: Violet-tinted `#8B5CF6` with official checkmark icon

### 5.2 Typography Scale
- **Headings & Editorial Display:** Bricolage Grotesque / Serif Editorial Touch for bold, startup-grade identity.
- **Body & Metadata:** Clean sans-serif system font stack (Inter / SF Pro Display) optimized for readability on mobile OLED screens.

---

## 6. Technical Architecture & Data Model (Supabase + React)

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite SPA                     │
│    (Tailwind CSS + Lucide Icons + Supabase Client)     │
└───────────────────────────┬────────────────────────────┘
                            │ Auth & Realtime Subscriptions
┌───────────────────────────▼────────────────────────────┐
│                    Supabase Backend                    │
│   ┌────────────────────────────────────────────────┐   │
│   │ Google OAuth (Restricted Domain: glbitm.ac.in) │   │
│   ├────────────────────────────────────────────────┤   │
│   │ PostgreSQL with Row Level Security (RLS)       │   │
│   │  • profiles (id, name, age, branch, year, bio) │   │
│   │  • profile_photos (id, profile_id, url, order) │   │
│   │  • likes (from_user, to_user, created_at)      │   │
│   │  • matches (user_a, user_b, matched_at)        │   │
│   │  • messages (id, match_id, sender_id, text)    │   │
│   │  • blocks (blocker_id, blocked_id)             │   │
│   ├────────────────────────────────────────────────┤   │
│   │ Supabase Storage (Buckets: profile-avatars)    │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

### 6.1 Row Level Security (RLS) Policy Highlights
- `profiles`: Readable by any authenticated user whose profile status is `active`; writable only by `auth.uid() = id`.
- `likes`: Insertable only by sender; readable only if sender matches `auth.uid()`.
- `messages`: Readable and insertable strictly if `auth.uid()` belongs to the active `match_id` record and no active block exists between the pair.

---

## 7. Metrics, KPIs & Success Criteria (Launch V1)

| Metric | Target (First 30 Days) | Measurement Method |
| :--- | :--- | :--- |
| **Verified Student Registrations** | ≥ 1,500 active campus accounts | Count of authenticated `@glbitm.ac.in` profiles |
| **Profile Completion Rate** | ≥ 85% of onboarding drop-offs | Step 1 through Step 4 wizard completion |
| **Match-to-Conversation Rate** | ≥ 60% of mutual matches | Threads with ≥ 1 message sent within 2 hours |
| **Safety & Moderation Score** | < 0.5% block/report incident rate | Flagged incident tickets via block modal |
| **Daily Active Users (DAU)** | ≥ 400 students browsing feed | Unique user sessions in discovery deck |

---

## 8. Rollout Plan & Milestones

1. **Phase 1: Design System & Core UI Components (Complete)**
   - High-fidelity screens: Discover, It's a Match!, Connections, Chat Session.
2. **Phase 2: Auth, Database & Storage Setup (Week 1–2)**
   - Domain whitelist validation, Supabase schema migration, RLS policies, Storage buckets.
3. **Phase 3: Frontend Integration & State Management (Week 3–4)**
   - Swipe deck gestures, optimistic chat rendering, Realtime WebSocket chat subscription.
4. **Phase 4: Closed Campus Alpha (Week 5)**
   - 100 student pilot across CSE, IT, and ECE student societies.
5. **Phase 5: Public Campus Launch (Week 6)**
   - Full campus deployment for GL Bajaj student body.
