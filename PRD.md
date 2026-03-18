# Product Requirements Document (PRD): Password Manager

## 1. Product Overview
A highly secure, scalable, and low-latency password manager application designed for multiple users. The application emphasizes a premium user experience utilizing an **Apple Design UI Standard**, featuring minimalist layouts, smooth micro-animations, glassmorphism, and intuitive navigation. The core functionality centers around managing a password database, providing quick access via one-click OTPs, and simplifying access with One-Time Logins.

## 2. Target Audience
- Individuals seeking a secure, elegant, and simplified way to manage their credentials.
- Users who appreciate premium, intuitive aesthetics akin to Apple's design language.
- Power users needing rapid access to 2FA codes without switching between multiple apps.

## 3. Core Features

### 3.1 Secure Password Database
- **Zero-Knowledge Architecture (Recommended)**: Passwords should be encrypted locally on the device before reaching the database.
- **CRUD Operations**: Users can securely add, read, update, and delete their credentials (Title, Username, Password, Website URL, Notes).
- **Categorization & Search**: Instant, low-latency search to quickly find desired credentials.

### 3.2 One-Click OTP (Authenticator)
- Built-in Time-based One-Time Password (TOTP) generator.
- Users can attach a TOTP secret to any credential.
- UI automatically displays a real-time countdown and the current OTP code.
- "One-Click" functionality directly copies the OTP to the clipboard.

### 3.3 One-Time Login (Passwordless Access)
- **Magic Links**: Users enter their email and receive a secure one-time login link, bypassing the need to remember a master password for initial device auth.
- **Quick Access**: Low-latency session management to ensure users stay securely logged in across their devices.

### 3.4 Apple Design UI Standard
- **Typography**: Clean, highly readable sans-serif fonts (e.g., Inter, SF Pro).
- **Visuals**: Use of subtle gradients, glassmorphism (translucency and background blur), rounded corners, and deep shadows for depth.
- **Animations**: Fluid, physics-based micro-animations (hover states, modal transitions, list reordering).
- **Themes**: Full support for seamless Light and Dark modes.

## 4. Technical & Architectural Requirements

### 4.1 Scalability & Low Latency
- **Frontend Framework**: React (Next.js or Vite) for fast rendering and optimized asset delivery.
- **Backend & Database**: A robust, scalable backend (e.g., Supabase / PostgreSQL) to handle many concurrent users.
- **Edge Caching**: Assets and non-sensitive data delivered via CDN.
- **State Management**: React Query or SWR for optimistic UI updates and aggressive local caching, ensuring the UI feels instant.

### 4.2 Security
- **Encryption**: AES-256 for data encryption.
- **Authentication**: Secure JWT-based or session-based authentication.
- **Row Level Security (RLS)**: Ensure users can only query and access their own data.

## 5. User Flows

### 5.1 Authentication Flow
1. User visits the app.
2. Chooses "Login via Email".
3. Receives a One-Time Login link in their inbox.
4. Clicks the link and is instantly authenticated and redirected to the vault.

### 5.2 Accessing Credentials & OTP
1. Authenticated user views their dashboard (Vault).
2. Taps or clicks on a specific account (e.g., "Google").
3. The detail pane slides in smoothly (Apple-style transition).
4. User clicks the "Copy" icon next to the password.
5. Below the password, the OTP code is visible with a pie-chart timer. Clicking it copies the OTP instantly.

## 6. Next Steps
1. **Initialize Project**: Setup the React working directory.
2. **Design System**: Establish the foundational CSS/Tailwind rules for the Apple-like UI (fonts, colors, blur utilities).
3. **Database Schema**: Design the user and credentials tables.
4. **Implement Auth**: Set up the One-Time Login functionality. 
