# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **password manager application** featuring zero-knowledge architecture, one-click OTP (TOTP), and magic link authentication. The design follows **Apple Design UI Standard** with minimalist layouts, glassmorphism, and smooth micro-animations.

**Current Status**: Greenfield project (not yet initialized). See `PRD.md` for full requirements.

## Architecture & Tech Stack (Planned)

- **Frontend**: React with Next.js or Vite
- **Backend**: Supabase / PostgreSQL
- **State Management**: React Query or SWR for optimistic UI updates
- **Security**: AES-256 encryption, zero-knowledge architecture
- **Authentication**: Magic links (one-time login), JWT/session-based auth
- **Styling**: Tailwind CSS with custom Apple-like design system

## Key Design Principles

### Apple Design UI Standard
- **Typography**: Clean sans-serif (e.g., Inter, SF Pro) - distinctive font choices preferred over generic ones
- **Visuals**: Subtle gradients, glassmorphism (translucency + blur), rounded corners, deep shadows
- **Animations**: Fluid, physics-based micro-animations (hover states, modal transitions)
- **Themes**: Seamless Light and Dark mode support
- **Spacing**: Use `gap-*` utilities, never `space-x-*` or `space-y-*`

### Color & Styling
- Use semantic tokens (`bg-primary`, `text-muted-foreground`) not raw values like `bg-blue-500`
- Use `cn()` utility for conditional classes, not manual template literal ternaries
- Glassmorphism: background blur, translucency, layered transparencies
- Avoid generic AI aesthetics (purple gradients on white, overused fonts)

## Available Skills

This project includes these specialized skills for agent assistance:

### shadcn
- **Purpose**: UI component management and composition
- **Usage**: Run `npx shadcn@latest info` for project context
- **Key Patterns**:
  - Forms: `FieldGroup` + `Field`, never raw `div` with spacing
  - Icons: Use `data-icon` attribute, no sizing classes on icons inside components
  - Composition: Check existing components first, compose rather than build custom
  - Styling: `className` for layout only, never override component colors/typography

### frontend-design
- **Purpose**: Create distinctive, production-grade interfaces
- **Key**: Avoid generic "AI slop" aesthetics - choose bold, intentional aesthetic directions
- **Focus**: Typography, color commitment, motion, spatial composition, atmospheric backgrounds

### vercel-react-best-practices
- **Purpose**: React performance optimization patterns
- **Coverage**: Async/parallel data fetching, bundle optimization, server-side performance, re-render reduction
- **Structure**: Rules organized by area (async-, bundle-, server-, client-, rerender-, rendering-, js-, advanced-)

## Security Requirements

- **Zero-Knowledge**: Encrypt passwords locally before database storage
- **Encryption**: AES-256 for all sensitive data
- **Authentication**: Row Level Security (RLS) - users access only their own data
- **TOTP**: Built-in Time-based One-Time Password generator with one-click copy

## Core Features to Implement

1. **Secure Password Database**: CRUD operations with instant search and categorization
2. **One-Click OTP**: TOTP with real-time countdown and clipboard copy
3. **One-Time Login**: Magic link authentication via email
4. **Premium UX**: Apple-style transitions, optimistic UI updates, low-latency responses

## Development Workflow

When building features:
1. Use `frontend-design` skill for UI components - commit to a bold aesthetic direction
2. Use `shadcn` skill for component composition - check existing components first
3. Apply `vercel-react-best-practices` for performance optimization
4. Ensure zero-knowledge encryption for all credential data
5. Test both Light and Dark modes

## Notes

- Project is not yet initialized - first step is choosing between Next.js and Vite
- All authentication flows should use magic links (no master password)
- TOTP secrets should be stored encrypted alongside credentials
- Emphasize premium, Apple-like UX in all interactions
