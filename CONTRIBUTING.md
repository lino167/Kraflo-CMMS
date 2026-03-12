# Contributing to Kraflo CMMS 🚀

First off, thank you for considering contributing to Kraflo! It's people like you who make Kraflo such a great tool for the maintenance community.

Kraflo is an **Open Source (FOSS)** project. We believe in democratizing industrial intelligence.

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: v20+
- **Bun** (Recommended) or **npm**
- **Supabase CLI**: For backend development

### 1. Clone & Install
```bash
git clone https://github.com/lino167/Kraflo-CMMS.git
cd Kraflo-CMMS
npm install
```

### 2. Backend Setup
We've made it easy to get up and running with Supabase:
```bash
# Run our setup script
chmod +x scripts/setup-supabase.sh
./scripts/setup-supabase.sh
```

### 3. Environment Variables
Create a `.env` file based on your Supabase project:
```env
VITE_SUPABASE_URL="yours"
VITE_SUPABASE_PUBLISHABLE_KEY="yours"
```

## 🗺️ Project Structure

- `/src`: Frontend (React + TS + Tailwind)
  - `/components`: UI and logic components
  - `/pages`: Main application views
  - `/hooks`: Custom React hooks (Auth, etc.)
- `/supabase`: Backend logic
  - `/migrations`: Database schema and RLS
  - `/functions`: Edge Functions (IA, Telegram, etc.)
- `/docs`: Technical documentation and automations

## 💡 How to Contribute

### Reporting Bugs
If you find a bug, please open an issue on GitHub. Include:
- A clear description of the bug
- Steps to reproduce
- Expected vs. actual behavior

### Suggesting Enhancements
We love new ideas! If you have a feature request:
- Open an issue with the "enhancement" label.
- Explain the use case and how it benefits the maintenance community.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. Ensure your code follows the existing style and passes linting (`npm run lint`).
3. If you're adding a feature, update the relevant documentation in `/docs`.
4. Open a PR with a clear description of your changes.

## 🤖 AI Modules & Integrations
If you want to contribute to the AI assistant or new integrations (like IoT):
- Check `supabase/functions/assistente-ia` for the core logic.
- See `docs/supabase-automacoes.md` for existing flows.

## 📄 License
By contributing, you agree that your contributions will be licensed under the project's license (MIT/GPL - check LICENSE file).

---
*Built with ❤️ for the future of maintenance.*
