# 🏮 Lantern

### A gentler way to understand your cycle.

**A private, thoughtful cycle-tracking companion designed to help you notice patterns, understand your body and prepare for what's ahead — without streaks, guilt, calorie counting or pressure.**

<p align="center">
  <a href="https://lanternforher.netlify.app/">
    <img src="https://img.shields.io/badge/Explore_Lantern-Live_App-9B806D?style=for-the-badge" alt="Live App" />
  </a>
  <a href="https://github.com/prajeet-sam/Lantern">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub Repository" />
  </a>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

---

## 🌷 The Idea Behind Lantern

Your menstrual cycle is not a productivity metric.

It isn't a streak to maintain, a number to optimize or something you should feel guilty about forgetting to track.

Yet many cycle-tracking and wellness applications make users feel exactly that way through streaks, pressure-driven notifications, calorie counting and engagement mechanics.

**Lantern takes a different approach.**

It is built around the idea that understanding your body should feel supportive, personal and empowering.

Instead of asking you to constantly optimize yourself, Lantern helps you:

- Understand your cycle.
- Notice patterns over time.
- Prepare for upcoming phases.
- Develop a better understanding of your body's rhythms.
- Build a more informed relationship with your wellbeing.

No judgment. No unnecessary pressure. Just a quieter companion that helps you understand yourself.

> Not another app telling you what to fix. A companion helping you understand what you feel.

---

## ✨ Core Features

### 01. 🌙 Private Cycle Tracking

A simple, approachable way to keep track of your menstrual cycle.

- Record and view cycle information.
- Maintain a personal cycle history.
- Explore your cycle timeline.
- Understand previous and upcoming cycle phases.

The experience is designed to feel personal rather than clinical or overwhelming.

### 02. 🔮 Cycle Predictions & Insights

Understand what might be coming next.

- Estimated upcoming period dates.
- Predicted cycle phases.
- Pattern recognition across recorded cycles.
- Insights based on historical cycle information.
- A clearer view of changes and variations over time.

Predictions are estimates, not guarantees. Cycle patterns can vary, and estimates should not be used as contraception or as a medical diagnosis.

### 03. 🌸 Pattern Recognition

Your cycle is more than a calendar.

Lantern aims to help users recognize patterns over time rather than simply collecting isolated entries.

- Review historical cycle information.
- Identify recurring patterns.
- Understand variations between cycles.
- Develop a more informed view of personal cycle trends.

### 04. 🕊️ A Guilt-Free Experience

One of Lantern's most important design decisions is what it deliberately leaves out.

- No streaks to break.
- No punitive missed-day notifications.
- No calorie counting.
- No weight-focused engagement mechanics.
- No public profiles.
- No social comparison feeds.

Missing a day should never make someone feel like they've failed.

### 05. 🎨 Calm, Minimal Interface

The interface is designed around emotional comfort and simplicity.

- Gentle visual language.
- Minimal, uncluttered layouts.
- Thoughtful interactions and transitions.
- Clear information hierarchy.
- A wellness-oriented experience rather than a clinical dashboard.

### 06. 🪞 Identity-First Wellness

Lantern is built around self-understanding, not self-optimization.

The philosophy is simple: users should feel supported in understanding their own bodies without being pushed toward arbitrary goals or metrics.

---

## 💭 Design Philosophy

Most wellness applications are designed around engagement.

Lantern is designed around the person using it.

| Traditional Engagement-Driven Approach | Lantern's Approach |
|---|---|
| Maintain your streak | Track whenever it feels useful |
| Don't miss a day | Your experience is valid even when you forget |
| Optimize your metrics | Understand your personal patterns |
| Compare your progress | Focus on your own experience |
| Constant reminders | Support without unnecessary pressure |
| Calorie and weight metrics | Cycle awareness and self-understanding |

**The goal isn't to make users open the application every day. It's to make the application worth returning to whenever they need it.**

---

## 🛠️ Technology Stack

Lantern uses a modern web application stack.

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16 | Application framework |
| UI Library | React 19 | Component-based interface |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS 4 | Responsive styling |
| Database & Backend Services | Supabase | Data and backend integration |
| Local Storage | IndexedDB (`idb`) | Browser-side data storage |
| Visualization | Recharts | Data visualization |
| Animations | Framer Motion | UI transitions and interactions |
| Date Utilities | date-fns | Date and cycle-related operations |
| Icons | Lucide React | Interface icons |
| Testing | Vitest | Automated testing |

---

## 🏗️ Project Structure

The repository follows a modular Next.js application structure.

```text
Lantern/
│
├── app/                      # Next.js application routes
│
├── components/               # Reusable UI components
│
├── docs/                     # Project documentation
│
├── lib/                      # Utilities and application logic
│
├── public/                   # Static assets and public resources
│
├── scripts/                  # Development and utility scripts
│
├── supabase/
│   └── migrations/           # Database migrations
│
├── tests/                    # Automated tests
│
├── types/                    # TypeScript type definitions
│
├── Dockerfile                # Container configuration
├── render.yaml               # Render deployment configuration
├── next.config.ts            # Next.js configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vitest.config.ts          # Test configuration
└── README.md
```

---

## 🚀 Getting Started

Want to explore Lantern locally or contribute to its development?

Follow the steps below.

### Prerequisites

Make sure you have:

- Node.js 20 or later.
- npm.
- Git.
- A Supabase project with the required application configuration.

### 1. Clone the Repository

```bash
git clone https://github.com/prajeet-sam/Lantern.git

cd Lantern
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root.

Configure the Supabase connection values expected by the application:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use the actual variable names and configuration required by the application.

**Important:** Never commit secret keys, service-role credentials or personal user data to GitHub. Public browser environment variables must never contain privileged credentials.

### 4. Configure the Database

Apply the database migrations provided in:

```text
supabase/migrations/
```

Ensure that the Supabase project has the required database schema and access policies before using the application.

### 5. Start the Development Server

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

### 6. Build for Production

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

---

## 🧪 Development & Testing

Lantern includes a development workflow with linting, TypeScript validation and automated tests.

### Run the linter

```bash
npm run lint
```

### Type checking

```bash
npm run typecheck
```

### Run tests

```bash
npm run test
```

### Watch mode

```bash
npm run test:watch
```

---

## 🔐 Privacy & Responsible Design

Cycle information is personal information.

Lantern's design philosophy puts privacy and user autonomy at the centre of the experience.

The product intentionally avoids:

- Public sharing of personal cycle information.
- Social comparison mechanics.
- Shame-based engagement.
- Unnecessary collection of wellness metrics.

Because the application integrates Supabase and browser-side storage, actual privacy depends on the deployed database configuration, access policies, authentication and storage implementation.

Sensitive cycle information should be protected with appropriate access controls and secure handling practices.

### Health Disclaimer

Lantern is a personal wellness and cycle-awareness application. It is not a medical device and does not diagnose, treat or prevent medical conditions.

Cycle predictions are estimates based on recorded information and may be inaccurate, particularly when cycles are irregular or changing.

The application should not be used as a substitute for professional medical advice, diagnosis, treatment or contraception.

---

## 🌱 Roadmap

Lantern is an evolving project. Potential areas for further development include:

- [ ] More detailed cycle-history insights.
- [ ] Expanded personal pattern visualizations.
- [ ] Customizable, gentle reminders.
- [ ] Improved accessibility.
- [ ] Personal data export and portability.
- [ ] Expanded offline capabilities.
- [ ] Continued improvements to cycle prediction and transparency.
- [ ] Further privacy and security enhancements.

---

## 🤝 Contributing

Contributions, suggestions and feedback are welcome.

If you are interested in women's wellness technology, privacy-conscious software, frontend engineering or thoughtful product design, feel free to contribute.

### Contribution Workflow

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Run the relevant checks and tests.
5. Submit a pull request.

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Lantern.git

cd Lantern

# Create a feature branch
git checkout -b feature/your-feature-name

# Commit your changes
git add .

git commit -m "feat: describe your changes"

# Push your branch
git push origin feature/your-feature-name
```

For significant changes, open an issue first to discuss the proposed implementation.

---

## 👨‍💻 Author

**Prajeet Sam**

B.Tech — Electronics & Telecommunication Engineering  
Symbiosis Institute of Technology, Pune

Interested in building thoughtful products at the intersection of technology, health, user experience and software engineering.

- GitHub: [@prajeet-sam](https://github.com/prajeet-sam)
- Project: [Lantern](https://github.com/prajeet-sam/Lantern)
- Live Application: [lanternforher.netlify.app](https://lanternforher.netlify.app/)

---

## 📄 License

Lantern is licensed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for details.

---

<p align="center">
  <strong>Understanding your cycle. Understanding yourself.</strong>
  <br/>
  Made with care. 🏮
  <br/><br/>
  ⭐ If you appreciate the idea behind Lantern, consider starring the repository.
</p>
