# CodeAstra 2026 - Hackathon Platform

A modern, cyberpunk-themed hackathon platform built with React, TypeScript, and Firebase for CodeAstra 2026.

## 🚀 Features

- **Multi-round Competition**: 3-round hackathon with online testing and offline finale
- **Real-time Updates**: Live Firebase integration for teams, submissions, and admin controls
- **Mobile Responsive**: Optimized UI for all device sizes with mobile-specific restrictions
- **GitHub Integration**: Round 2 submissions via GitHub repository links
- **Admin Dashboard**: Comprehensive admin tools for managing the competition
- **Development Tools**: Built-in dev admin tools for testing and debugging
- **Cyberpunk Theme**: Futuristic UI with glassmorphism and neon effects

## 📁 Project Structure

```
codeastra-2026/
├── index.html            # Main HTML template
├── index.tsx             # Application entry point
├── src/                  # Source code
│   ├── components/       # Reusable UI components
│   │   ├── common.tsx    # Shared UI components and icons
│   │   └── DevAdminTools.tsx # Development admin tools
│   ├── App.tsx           # Main application component
│   ├── firebaseConfig.ts # Firebase configuration
│   ├── types.ts          # TypeScript type definitions
│   └── mockDb.ts         # Mock database for development
├── config/               # Firebase configuration files
│   ├── firebase.json     # Firebase deployment config
│   ├── firestore.rules   # Firestore security rules
│   ├── storage.rules     # Firebase Storage rules
│   ├── cors.json         # CORS configuration
│   └── .firebaserc       # Firebase project configuration
├── scripts/              # Utility scripts
│   ├── init-firestore.js # Initialize Firestore data
│   ├── approve-all-teams.js # Bulk approve teams
│   └── set-team-status.js # Update team statuses
├── docs/                 # Documentation
│   ├── README.md         # This file
│   └── metadata.json     # Project metadata
├── dist/                 # Build output (generated)
├── .env.local            # Environment variables (ignored)
└── package.json          # Dependencies and scripts
```

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Hosting, Storage)
- **Build Tool**: Vite 6
- **Animations**: Framer Motion
- **Routing**: React Router DOM
- **Icons**: Heroicons (via custom components)
- **Deployment**: Firebase Hosting

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Vicky-bud/codeastra-2026.git
   cd codeastra-2026
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Setup**
   ```bash
   firebase login
   firebase init
   # Select Hosting, Firestore, and Storage
   # Choose your Firebase project
   ```

4. **Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   ```

## 🔥 Firebase Deployment

### Step-by-Step Deployment

1. **Login to Firebase**
   ```bash
   firebase login
   ```

2. **Initialize Firebase (if not done)**
   ```bash
   firebase init
   ```

3. **Build the Application**
   ```bash
   npm run build
   ```

4. **Deploy to Firebase**
   ```bash
   firebase deploy
   ```

### Firebase Services Used

- **Firebase Hosting**: Static file hosting
- **Firestore**: Real-time database for teams and submissions
- **Firebase Auth**: User authentication
- **Firebase Storage**: File storage (optional, for future use)

## 🎯 Competition Rounds

### Round 1: Online Screening Test
- Multiple choice questions (MCQs)
- Coding problems with integrated code editor and test case validation
- Support for multiple programming languages (JavaScript, Python, Java, C, C++)
- 60-minute time limit with real-time countdown
- Anti-cheating measures (fullscreen mode, tab monitoring, disqualification for violations)

### Round 2: AI/ML Challenge
- Problem statement provided by organizers
- Teams submit GitHub repository links
- Manual grading by judges
- 48-hour submission window

### Round 3: Offline Finale
- Physical hackathon at NIT Silchar
- Real-time problem solving
- Final presentations and judging

## 👥 User Roles

### Team Members
- Register and create teams
- Take Round 1 test
- Submit GitHub repository for Round 2
- View competition status and results

### Administrators
- Manage team registrations and approvals
- Configure competition settings and questions
- Start/stop rounds with real-time controls
- Grade Round 2 submissions manually
- View comprehensive analytics and results
- Access development tools for testing and debugging

## 🎨 UI/UX Features

- **Cyberpunk Theme**: Neon colors, glassmorphism effects
- **Responsive Design**: Mobile-first approach
- **Smooth Animations**: Framer Motion transitions
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Dark Mode**: Consistent dark theme throughout

## 🔧 Development

### Available Scripts

```bash
npm run dev                # Start development server
npm run build              # Build for production
npm run preview            # Preview production build
npm run init-firestore     # Initialize Firestore with default data
npm run approve-all-teams  # Bulk approve all pending teams
npm run set-team-status    # Update team statuses via script
```

### Build Optimizations

- **Code Splitting**: Vendor chunks for React, Firebase, and other libraries
- **Minification**: Terser with console/debugger removal in production
- **Dependency Optimization**: Pre-bundled critical dependencies
- **Asset Optimization**: Efficient chunk splitting for better caching

### Code Quality

- TypeScript for type safety
- Vite for fast development and optimized builds
- Modular component architecture
- Responsive design with Tailwind CSS

## 🔒 Security

- Firebase Authentication for user management
- Firestore security rules for data access control
- Input validation and sanitization
- Anti-cheating measures for online tests

## 📱 Mobile Optimization

- Responsive grid layouts
- Touch-friendly buttons and inputs
- Optimized animations for mobile devices
- Portrait mode timeline adaptation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Email: codeastra26@gmail.com
- GitHub Issues: https://github.com/Vicky-bud/codeastra-2026/issues

## 🙏 Acknowledgments

- NIT Silchar for organizing CodeAstra 2026
- Firebase for backend services
- React and TypeScript communities
- All contributors and participants

---

**Built with ❤️, CodeAstra 2026**
