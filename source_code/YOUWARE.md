# YOUWARE.md - NeuralConnect WhatsApp Business Dashboard

This is a modern React application for managing WhatsApp Business operations with a Gen-AI aesthetic theme.

## Project Overview

**Project Name**: NeuralConnect - WhatsApp Business Intelligence Suite
**Project Type**: React + TypeScript Modern Web Application
**Entry Point**: `src/main.tsx` (React application entry)
**Build System**: Vite 7.0.0 (Fast development and build)
**Styling System**: Tailwind CSS 3.4.17 (Atomic CSS framework)

## Core Design Philosophy

### Gen-AI Aesthetic Theme
- **Visual Language**: "State-of-the-Art Generative AI" with deep space indigos, bioluminescent cyan accents
- **Glassmorphism**: Subtle glassmorphism on panels with 85-95% opacity
- **Typography**: Poppins font family (weights: 300, 400, 500, 600)
- **Theme Support**: Robust Light/Dark/System auto-switch theme provider
- **Color Palette**:
  - Dark Mode (Default): Background #0f172a, Surface #1e293b, Accents #8b5cf6 (Violet) & #06b6d4 (Cyan)
  - Light Mode: Background #f8fafc, Surface #ffffff, Accent #6366f1 (Indigo)
- **Border Radius**: Custom 12px for all cards and panels
- **Animation**: Smooth transitions with 0.3s ease-in-out timing

## Application Structure

### Layout Components
- **Sidebar**: Collapsible navigation (left panel) with route badges and icons
- **Header**: Theme switcher and page title
- **Main Content**: Fluid center area for page content
- **ContextPanel**: AI Insights and quick actions (right panel, hidden on mobile)

### Implemented Pages

#### 1. Dashboard (Neural Command Center)
**Route**: `/`
**Components**: 
- `MetricCard`: Displays key metrics with trend indicators
- `AlertCard`: Shows system alerts with severity levels
- `Header`: Page header with theme controls
- `ContextPanel`: AI insights and quick actions

**Features**:
- Real-time metrics display (Open Conversations, Pending Meta Approvals, API Health, Daily Active Users)
- Smart Alert System with severity indicators (CRITICAL, HIGH, MEDIUM, LOW)
- Skeleton loading states for improved UX
- Responsive grid layout (4 columns on desktop, 2 on tablet, 1 on mobile)

#### 2. Live Inbox (Coming Soon)
**Route**: `/inbox`
- Will feature unified omni-inbox for all WhatsApp correspondence
- Message categorization (Marketing, Service, Utility)
- AI Draft suggestion functionality

#### 3. Template Forge (Coming Soon)
**Route**: `/templates`
- Template builder for WhatsApp templates
- Meta integration status tracking
- Status indicators: Draft, Pushing to Meta, Approved, Rejected

#### 4. Client 360 (Coming Soon)
**Route**: `/clients`
- CRM functionality
- Client profile with tags (VIP, Cold Lead, etc.)
- Conversation history

#### 5. System Alerts (Coming Soon)
**Route**: `/alerts`
- Dedicated notification center
- Alert management and filtering

## Tech Stack

### Core Framework
- **React**: 18.3.1 - Declarative UI library
- **TypeScript**: 5.8.3 - Type-safe JavaScript
- **Vite**: 7.0.0 - Build tool
- **Tailwind CSS**: 3.4.17 - Utility-first CSS

### Routing and State
- **React Router DOM**: 6.30.1 - Client-side routing
- **Zustand**: 4.4.7 - State management (available but not yet used)

### UI Components
- **Lucide React**: Icon library
- **Framer Motion**: 11.0.8 - Animation library (available but not yet used)

## Key Files and Directories

```
src/
├── components/           # Reusable UI components
│   ├── AlertCard.tsx    # Alert display component
│   ├── MetricCard.tsx   # Metric display with trends
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── Header.tsx       # Page header with theme switcher
│   └── ContextPanel.tsx # Right-side AI insights panel
├── contexts/            # React contexts
│   └── ThemeContext.tsx # Theme provider (light/dark/system)
├── pages/               # Page components
│   └── Dashboard.tsx    # Main dashboard page
├── mocks/               # Mock data
│   └── dashboardData.ts # Sample metrics and alerts
├── App.tsx              # Main app component with routing
├── main.tsx             # Application entry point
└── index.css            # Global styles and Tailwind
```

## Development Commands

- **Install dependencies**: `npm install`
- **Build project**: `npm run build`
- **Development server** (if needed): `npm run dev` - runs on http://localhost:5173

## Build and Deployment

The project uses Vite build system:
- **Build output**: `dist/` directory
- **Optimized production build**: Automatic code splitting
- **CSS**: Tailwind compiled and optimized

## Custom Tailwind Classes

### Glass Panel Utilities
- `.glass-panel` - Standard glassmorphism with 85% opacity
- `.glass-panel-strong` - Stronger glassmorphism with 95% opacity
- `.btn-primary` - Primary gradient button with neon shadow
- `.btn-secondary` - Secondary cyan button
- `.skeleton` - Loading skeleton with pulse animation
- `.skeleton-shimmer` - Shimmer effect for loading states

## Theme System

The application uses a context-based theme system:
- **Modes**: Light, Dark, System (auto-detect)
- **Persistence**: Theme preference saved to localStorage
- **Key**: `neuralconnect-theme`
- **Usage**: Import and use `useTheme()` hook from `ThemeContext`

## Mock Data Structure

### Metrics
```typescript
interface Metric {
  id: string;
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
}
```

### Alerts
```typescript
interface Alert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'FOLLOW_UP' | 'REVIEW_REQUEST' | 'SYSTEM_ERROR' | 'SENTIMENT' | 'TEMPLATE';
  title: string;
  message: string;
  timestamp: string;
  is_read: boolean;
}
```

## Future Development Notes

### Next Implementation Steps
1. **Unified Inbox**: Implement chat interface with message history and AI Draft suggestions
2. **Template Manager**: Build template creation form with Meta API integration
3. **Client CRM**: Develop client management with tags and conversation tracking
4. **Backend Integration**: Connect to actual WhatsApp Business API and database
5. **Real-time Updates**: Implement WebSocket connections for live data

### Recommended Patterns
- Use skeleton loaders for all async operations
- Maintain 12px border radius across all components
- Follow glassmorphism aesthetic for panels
- Use Tailwind utility classes over custom CSS
- Implement responsive design with mobile-first approach

## Configuration Files

- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind theme customization
- `postcss.config.js` - PostCSS configuration

## ⚠️ CRITICAL: Do NOT Modify Entry Point

**WARNING**: Never modify this line in `index.html`:
```html
<script type="module" src="/src/main.tsx"></script>
```

This is the core entry point. Any modification will break the application.

## Notes for AI Assistant

When working on this project:
1. Maintain the Gen-AI aesthetic throughout all components
2. Use the established color palette and design tokens
3. Implement skeleton loaders for loading states
4. Ensure mobile responsiveness (sidebar collapses, panels stack)
5. Follow the established component patterns
6. Keep glassmorphism consistent across panels
7. Use Poppins font weights as specified (300 for body, 500 for UI, 600 for headers)
