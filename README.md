# Kraflo CMMS

Kraflo is a modern, premium **Computerized Maintenance Management System (CMMS)** designed for high-performance teams. It features a "Deep Tech / Glassmorphism" aesthetic, providing a top-tier user experience while maintaining robust, enterprise-grade functionality for managing equipment, work orders (Ordens de Serviço), and technical teams.

## 🌟 Key Features

- **Premium UI/UX:** Built with a "Floating Command Bridge" navigation and a "Bento Box" dashboard layout, utilizing glassmorphism and modern micro-animations.
- **Advanced Dashboard:** Real-time metrics, operational summaries, and equipment tracking in an intuitive, asynchronous layout.
- **Work Order Management (OS):** Create, track, and manage maintenance tasks efficiently.
- **Knowledge Base (Biblioteca):** Centralized repository for manuals and procedures.
- **AI Assistant:** Integrated AI for technical assistance and insights.
- **Role-Based Access Control:** Secure, granular permissions using Supabase RLS policies.

## 🛠️ Technology Stack

**Frontend:**
- **React 18** (Vite)
- **TypeScript**
- **Tailwind CSS** (Custom Premium "Deep Tech" Theme)
- **shadcn/ui** (Radix UI) for accessible, high-quality components
- **React Router v6** for navigation
- **TanStack React Query** for data fetching and caching
- **React Hook Form + Zod** for robust form handling and validation
- **Lucide React** for icons
- **Recharts** for data visualization

**Backend & Infrastructure:**
- **Supabase** (PostgreSQL)
  - **Edge Functions** (Deno) for secure, server-side logic (Role Management, AI, Queues).
  - **Row Level Security (RLS)** explicitly optimized with subqueries for high performance at scale.
  - **Postgres Triggers & Functions** for automated database workflows.
- **GitHub Actions:** CI/CD pipeline integrated for automated TypeScript checking and building.

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+)
- npm or pnpm
- A Supabase project (for backend services)

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/lino167/Kraflo-CMMS.git
   cd Kraflo-CMMS
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
   VITE_SUPABASE_PROJECT_ID="your-project-id"
   ```

4. **Start the development server:**
   ```sh
   npm run dev
   ```

## 🔒 Security & Architecture

Kraflo takes security seriously. The backend is strictly controlled via **Supabase RLS**. All critical operations (like role assignments and automated queue processing) are isolated in **Edge Functions** that require strict JWT validation (`verify_jwt: true`) and run under the `service_role` securely.

## 🤝 Contribution & Deployment

This project uses **GitHub Actions** for Continuous Integration. Every push to the `main` branch triggers a workflow that validates TypeScript and verifies the Vite production build.

---
*Built for the future of maintenance management.*
