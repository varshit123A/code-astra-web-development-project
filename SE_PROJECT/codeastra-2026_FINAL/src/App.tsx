



import { db as firestore, auth } from './firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, getDocs, addDoc, updateDoc, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import React, { useState, createContext, useContext, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import DevAdminTools from './components/DevAdminTools';
import { HashRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Team, TeamMember, TeamStatus, Round1Question, MockDB, AdminState, TestCase, Round1Answer } from './types';
import { MOCK_DB as INITIAL_DB } from './mockDb';

import { 
    CodeAstraLogo, CustomNetworkIcon, CustomSkillIcon, CustomPrizeIcon, CustomProblemIcon, 
    ChevronDown, CheckCircleIcon, CheckCircleListIcon, ClockIcon, UploadIcon, TrophyIcon, UsersIcon, 
    ClipboardListIcon, CogIcon, FileUploadIcon, DocumentTextIcon, BeakerIcon, FlagIcon, 
    CheckBadgeIcon, ExclamationTriangleIcon, UserCircleIcon, AcademicCapIcon, HomeIcon, 
    UserCheckIcon, PlusCircleIcon, TrashIcon, Card, CustomCheckbox, Modal, PageTransition,
    ArrowsPointingOutIcon, ArrowsPointingInIcon, MenuIcon, XIcon, CodeEditor
} from './components/common';


// --- Utility Component ---
const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

// Simple Error Boundary to catch render errors and show a useful message
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
    props: any;
    state: { hasError: boolean; error: any };

    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, info: any) {
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="max-w-md p-6 bg-red-50 border border-red-200 rounded">
                        <h3 className="text-lg font-bold text-red-700">Something went wrong</h3>
                        <p className="text-sm text-red-600 mt-2">An error occurred while loading this section. Check the console for details.</p>
                        <pre className="mt-3 text-xs text-red-500">{String(this.state.error)}</pre>
                    </div>
                </div>
            );
        }
        return this.props.children as any;
    }
}

// --- Authentication Context ---
const AuthContext = createContext<any>(null);
const useAuth = () => useContext(AuthContext);
export { useAuth };

// IN: src/App.tsx
// REPLACE the old AuthProvider component with this new one.

// --- Auth Provider ---
// --- Auth Provider ---
// --- Auth Provider (FINAL FIXED VERSION) ---
const AuthProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [adminState, setAdminState] = useState<AdminState | null>(null);

  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const teamsRef = useRef<Team[]>([]);
  const adminStateRef = useRef<AdminState | null>(null);

  // 1) Load Teams + Realtime Snapshot
  useEffect(() => {
    let unsub: (() => void) | null = null;

    async function loadTeams() {
      try {
        setLoadingTeams(true);

        const ref = collection(firestore, "teams");
        const snap = await getDocs(ref);
        const initial = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setTeams(initial);
        teamsRef.current = initial;

        unsub = onSnapshot(ref, (s) => {
          const all = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
          if (JSON.stringify(teamsRef.current) !== JSON.stringify(all)) {
            setTeams(all);
            teamsRef.current = all;
          }
        });

        setLoadingTeams(false);
      } catch (err) {
        console.error("[TEAMS ERROR]", err);
        setLoadingTeams(false);
      }
    }

    loadTeams();
    return () => unsub && unsub();
  }, []);

  // 2) Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setLoadingAuth(false);
    });

    return () => unsub();
  }, []);

  // 3) Admin Config Listener
  useEffect(() => {
    const ref = doc(firestore, "adminState", "config");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AdminState;
        if (JSON.stringify(adminStateRef.current) !== JSON.stringify(data)) {
          setAdminState(data);
          adminStateRef.current = data;
        }
      }
    });

    return () => unsub();
  }, []);

  // 3.5) Compute matchedTeam
  const matchedTeam = useMemo(() => {
    if (!firebaseUser || !teams) return null;
    const email = firebaseUser.email?.toLowerCase();
    return teams.find(t => {
      const leader = typeof t.leaderEmail === "string" ? t.leaderEmail.toLowerCase() : "";
      const members = Array.isArray(t.members) ? t.members.filter(m => typeof m === "string").map(m => m.toLowerCase()) : [];
      return leader === email || members.includes(email);
    }) || null;
  }, [firebaseUser, teams]);

  // 4) Auth Actions
  const login = useCallback(async (email: string, password: string) => {
    setError(null);

    // Special handling for admin login - create user if doesn't exist
    if (email === "admin@codeastra.com") {
      try {
        const user = await signInWithEmailAndPassword(auth, email, password);
        return user.user;
      } catch (error: any) {
        // If admin doesn't exist, create it
        if (error.code === 'auth/user-not-found') {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            return userCredential.user;
          } catch (createError: any) {
            // If creation fails (e.g., weak password), try to sign in again
            if (createError.code === 'auth/weak-password') {
              // For admin, accept any password
              const userCredential = await createUserWithEmailAndPassword(auth, email, "admin123!");
              return userCredential.user;
            }
            throw createError;
          }
        }
        throw error;
      }
    }

    // Regular user login
    const user = await signInWithEmailAndPassword(auth, email, password);
    return user.user; // wait for AuthProvider to update context
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setFirebaseUser(null);
  }, []);

  // 5) Your Functions (integrated)
  const registerTeam = useCallback(async (teamData: any) => {
    try {
      const existing = teams?.find(t => t.leaderEmail === teamData.leaderEmail);
      if (existing) throw new Error("Email already registered.");

      const teamToCreate = {
        ...teamData,
        status: teamData.status || "pending",
        createdAt: serverTimestamp()
      };

      if (teamData.leaderEmail && teamData.passwordHash) {
        try {
          await createUserWithEmailAndPassword(auth, teamData.leaderEmail, teamData.passwordHash);
        } catch (authError: any) {
          // If user already exists in Auth, that's okay - we'll still create the team
          if (authError.code !== 'auth/email-already-in-use') {
            throw authError;
          }
        }
        // Sign out to keep the registration flow clean
        await signOut(auth);
      }

      const docRef = await addDoc(collection(firestore, "teams"), teamToCreate);

      return { id: docRef.id, ...teamToCreate };
    } catch (err) {
      console.error("[REGISTER ERROR]", err);
      throw err;
    }
  }, [teams]);

  const updateTeam = useCallback(async (teamId: string, patch: Partial<Team>) => {
    const ref = doc(firestore, "teams", teamId);
    await updateDoc(ref, patch as any);
  }, []);

  const updateAdminState = useCallback(async (patch: Partial<AdminState>) => {
    const ref = doc(firestore, "adminState", "config");
    await setDoc(ref, patch as any, { merge: true });
  }, []);

  // 6) Final Combined User
  const user = useMemo(() =>
    firebaseUser
      ? {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          role: firebaseUser.email === "admin@codeastra.com" ? "admin" : "team",
          teamId: matchedTeam?.id || null,
          team: matchedTeam || null,
        }
      : null,
    [firebaseUser, matchedTeam]
  );

  // Memoized db object
  const db = useMemo(() => ({ teams, adminState }), [teams, adminState]);

  // 7) Context Output
  const value = useMemo(() => ({
    db,
    user,
    loading: loadingTeams || loadingAuth,
    error,
    login,
    logout,
    registerTeam,
    updateTeam,
    updateAdminState,
  }), [db, user, loadingTeams, loadingAuth, error, login, logout, registerTeam, updateTeam, updateAdminState]);

  if (loadingTeams || loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};






// --- Layout Components ---
const Header = () => {
    const { user, logout, db } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);


    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);
    
    const navLinkClasses = "text-brand-text-dark hover:text-brand-secondary transition block py-2 px-2 rounded-lg hover:bg-brand-surface/50";

    const publicNavLinks = (
        <>
            <Link to="/details" className={navLinkClasses}>Details</Link>
            <Link to="/faq" className={navLinkClasses}>FAQ</Link>
            <Link to="/contact" className={navLinkClasses}>Contact</Link>
            <Link to="/login" className={navLinkClasses}>Login</Link>
            {db?.adminState?.registrations_open ? (
                <Link to="/register" className="mt-2 block text-center bg-gradient-to-r from-brand-primary to-brand-secondary text-brand-dark font-semibold py-2 px-4 rounded-lg transition-opacity duration-300 animate-glow-primary hover:opacity-90">Register Now</Link>
            ) : (
                <button disabled className="mt-2 w-full bg-gray-600 text-gray-400 font-semibold py-2 px-4 rounded-lg cursor-not-allowed">Registrations Closed</button>
            )}
        </>
    );

    const loggedInNavLinks = (
        <>
            <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} className={navLinkClasses}>Dashboard</Link>
            <button onClick={logout} className="mt-2 w-full bg-brand-primary/80 hover:bg-brand-primary text-brand-dark font-semibold py-2 px-4 rounded-lg transition animate-glow-primary">Logout</button>
        </>
    );

    return (
        <header className="fixed top-0 left-0 right-0 z-50 glassmorphism">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 md:h-20">
                    <Link to="/" className="flex items-center space-x-2">
                        <CodeAstraLogo />
                        <span className="text-xl font-bold text-brand-text">CodeAstra 2026</span>
                    </Link>
                    
                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center space-x-4">
                        {user ? loggedInNavLinks : publicNavLinks}
                    </nav>

                    {/* Mobile Nav Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 rounded-lg bg-brand-surface/80 hover:bg-brand-surface transition-colors"
                            aria-label="Toggle menu"
                        >
                            {isMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>
             {/* Mobile Menu */}
             <AnimatePresence>
                {isMenuOpen && (
                    <motion.nav
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden glassmorphism border-t border-brand-primary/20 px-4 pb-4 space-y-2"
                    >
                         {user ? loggedInNavLinks : publicNavLinks}
                    </motion.nav>
                )}
            </AnimatePresence>
        </header>
    );
};

const Footer = () => {
    const location = useLocation();
    const isHomePage = location.pathname === '/';

    return (
        <footer className="py-12 mt-24 border-t border-white/10 text-center">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {isHomePage && (
                     <div className="mb-10">
                        <h3 className="text-3xl font-bold text-brand-secondary mb-3">Support the Future of Tech</h3>
                        <p className="max-w-2xl mx-auto text-brand-text-dark mb-6">
                            Partner with CodeAstra 2026 to connect with the brightest minds in the nation, showcase your brand, and invest in the next generation of technological innovation.
                        </p>
                        <a 
                            href="mailto:partners@codeastra.com" 
                            className="inline-block bg-brand-secondary text-brand-dark font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 animate-glow-secondary"
                        >
                            Become a Sponsor
                        </a>
                    </div>
                )}
                <p className="text-brand-text-dark">&copy; 2024 CodeAstra. Organized by NIT Silchar. All Rights Reserved.</p>
            </div>
        </footer>
    );
};


// --- Page Components ---

const HomePage = () => {
    const { db } = useAuth();
    const timelineRef = useRef<HTMLDivElement>(null);

    const timeline = [
        { date: "Dec 1, 2025", event: "Registration Opens" },
        { date: "Dec 30, 2025", event: "Registration Deadline" },
        { date: "Jan 12, 2026", event: "Round 1 (Online)" },
        { date: "Jan 20, 2026", event: "Round 1 Results" },
        { date: "Feb 3, 2026", event: "Round 2 (Online)" },
        { date: "Feb 17, 2026", event: "Round 2 Results" },
        { date: "Feb 24, 2026", event: "Round 3 (Offline Finale)" },
        { date: "Feb 26, 2026", event: "Final Results & Ceremony" },
    ];
    
    const prizes = [
        { place: "1st", amount: "₹50,000", bg: "from-brand-primary to-purple-600", shadow: "shadow-[0_0_20px_#FF00FF]", border: "border-brand-primary/80" },
        { place: "2nd", amount: "₹40,000", bg: "from-brand-secondary to-blue-400", shadow: "shadow-[0_0_20px_#00E5FF]", border: "border-brand-secondary/80" },
        { place: "3rd", amount: "₹30,000", bg: "from-brand-tertiary to-yellow-600", shadow: "shadow-[0_0_20px_#FF8C00]", border: "border-brand-tertiary/80" },
    ];

    const whyParticipate = [
        { icon: CustomNetworkIcon, title: "Expand Your Network", description: "Connect with fellow innovators, mentors, and industry professionals." },
        { icon: CustomSkillIcon, title: "Showcase Your Skills", description: "Put your coding and problem-solving abilities to the ultimate test." },
        { icon: CustomPrizeIcon, title: "Win Big Prizes", description: "Compete for a large prize pool and gain recognition for your talent." },
        { icon: CustomProblemIcon, title: "Solve Real Problems", description: "Tackle meaningful challenges and create impactful solutions." },
    ];
    
    const timelineItemVariants: Variants = {
        hidden: (isLeft: boolean) => ({
            opacity: 0,
            x: isLeft ? -100 : 100,
        }),
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                duration: 0.8,
            },
        },
    };

    return (
        <PageTransition>
            <div className="pt-20">
                {/* Hero Section */}
                <section className="text-center py-24 md:py-32">
                    <motion.h1 
                        className="text-4xl sm:text-5xl md:text-7xl font-bold bg-gradient-to-r from-brand-secondary to-brand-primary text-transparent bg-clip-text mb-4"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
                    >
                        CodeAstra 2026
                    </motion.h1>
                    <motion.p 
                        className="text-lg md:text-2xl text-brand-text-dark mb-8"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        Empowering the Stars of Code
                    </motion.p>
                    <motion.div 
                        className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        {db?.adminState?.registrations_open ? (
                             <Link to="/register" className="w-full sm:w-auto bg-gradient-to-r from-brand-primary to-brand-secondary text-brand-dark font-bold py-3 px-8 rounded-full transition-transform duration-300 hover:scale-105 animate-subtle-float">Register Now</Link>
                        ) : (
                            <button disabled className="w-full sm:w-auto bg-gray-600 text-gray-400 font-bold py-3 px-8 rounded-full cursor-not-allowed">Registrations Closed</button>
                        )}
                        <Link to="/details" className="w-full sm:w-auto bg-transparent border-2 border-brand-primary text-brand-primary font-bold py-3 px-8 rounded-full transition-all hover:bg-brand-primary/20">Details</Link>
                    </motion.div>
                </section>
                
                 {/* What is CodeAstra Section */}
                <section className="py-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.8 }}
                    >
                        <Card className="text-center">
                            <h2 className="text-3xl font-bold text-center mb-4 text-brand-primary">What is CodeAstra 2026?</h2>
                            <p className="max-w-3xl mx-auto text-lg text-brand-text-dark leading-relaxed">
                                CodeAstra is the nation's premier coding competition conducted by NIT Silchar where innovation meets ambition. It's more than a hackathon—it's a launchpad for the next generation of tech leaders. This Hackathon aims to provide a national platform for students, researchers, and tech-enthusiasts to showcase their coding and problem-solving skills. Participants will tackle real-world problems using AI, ML and other emerging technologies.
                            </p>
                        </Card>
                    </motion.div>
                </section>


                 {/* Why Participate Section */}
                <section className="py-16">
                    <h2 className="text-3xl font-bold text-center mb-12">Why Participate?</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {whyParticipate.map((item, index) => (
                            <motion.div 
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.5 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="text-center h-full">
                                    <item.icon className="w-12 h-12 mx-auto text-brand-secondary mb-4" />
                                    <h3 className="text-xl font-bold text-brand-text mb-2">{item.title}</h3>
                                    <p className="text-brand-text-dark">{item.description}</p>
                                 </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>
                
                {/* Timeline Section */}
                <section className="py-16" ref={timelineRef}>
                    <h2 className="text-3xl font-bold text-center mb-12">Event Timeline</h2>
                    <div className="relative max-w-sm md:max-w-3xl mx-auto">
                        {/* Desktop: Vertical line */}
                        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-brand-primary/50 to-brand-secondary/50" aria-hidden="true"></div>
                        {timeline.map((item, index) => {
                            const isLeft = index % 2 === 0;
                            return (
                                <div key={index} className="relative mb-8 md:mb-10 flex w-full md:items-center">
                                    {/* Mobile: Vertical stack with dot at top */}
                                    <div className="flex flex-col items-center w-full md:hidden">
                                        <motion.div
                                            className="w-4 h-4 rounded-full bg-brand-primary ring-4 ring-brand-dark z-10 mb-3"
                                            initial={{ scale: 0 }}
                                            whileInView={{ scale: 1 }}
                                            viewport={{ amount: 0.5, once: true }}
                                            transition={{ duration: 0.3, delay: index * 0.1 }}
                                        ></motion.div>
                                        <motion.div
                                            className="text-center"
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ amount: 0.5, once: true }}
                                            transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                                        >
                                            <p className="font-bold text-brand-primary text-base mb-1">{item.date}</p>
                                            <p className="text-brand-text-dark text-sm">{item.event}</p>
                                        </motion.div>
                                    </div>

                                    {/* Desktop: Horizontal alternating layout */}
                                    <div className="hidden md:flex w-full items-center">
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-brand-primary ring-4 ring-brand-dark z-10"></div>
                                        <motion.div
                                            className={`w-1/2 p-4 ${isLeft ? 'mr-auto text-right' : 'ml-auto text-left'}`}
                                            custom={isLeft}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ amount: 0.5, once: true }}
                                            variants={timelineItemVariants}
                                        >
                                            <p className="font-bold text-brand-primary text-base">{item.date}</p>
                                            <p className="text-brand-text-dark text-base">{item.event}</p>
                                        </motion.div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Prizes Section */}
                <section className="py-16">
                    <h2 className="text-3xl font-bold text-center mb-12">Prizes & Recognition</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {prizes.map(p => (
                             <Card key={p.place} className={`text-center transition-all duration-300 hover:!scale-105 hover:!border-white/50 ${p.shadow} border-2 ${p.border}`}>
                                <div className={`text-6xl font-bold mb-4 bg-gradient-to-br ${p.bg} text-transparent bg-clip-text`}>{p.place}</div>
                                <p className="text-3xl font-semibold">{p.amount}</p>
                                <p className="text-brand-text-dark">+ Certificate of Achievement</p>
                            </Card>
                        ))}
                        <Card className="md:col-span-3 text-center">
                            <h3 className="text-2xl font-bold text-brand-primary mb-4">Certificates for All</h3>
                            <ul className="space-y-2 text-brand-text-dark text-left sm:text-center">
                                <li className="flex items-center justify-start sm:justify-center"><CheckCircleListIcon/> &nbsp; <strong>Participation Certificate:</strong> All registered participants.</li>
                                <li className="flex items-center justify-start sm:justify-center"><CheckCircleListIcon/> &nbsp; <strong>Appreciation Certificate:</strong> Top 75% performers.</li>
                                <li className="flex items-center justify-start sm:justify-center"><CheckCircleListIcon/> &nbsp; <strong>Outstanding Performance:</strong> Top 10% performers (scoring ≥80%).</li>
                            </ul>
                        </Card>
                    </div>
                </section>
            </div>
        </PageTransition>
    );
};

const DetailsPage = () => {
    const detailItem = "pl-6 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-brand-secondary before:rounded-full";

    return (
        <PageTransition>
            <div className="min-h-screen pt-24 md:pt-28 pb-10">
                <section className="text-center mb-16">
                     <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-secondary to-brand-primary text-transparent bg-clip-text mb-4">
                        Rules & Details
                    </h1>
                    <p className="text-lg md:text-xl text-brand-text-dark max-w-3xl mx-auto">
                        Key information regarding the competition structure, prizes, and registration process.
                    </p>
                </section>
                <section className="max-w-4xl mx-auto space-y-12">
                     <Card>
                        <h2 className="text-2xl font-bold text-brand-primary mb-6">Competition Details</h2>
                        <ul className="space-y-4 text-brand-text-dark">
                            <li className={detailItem}><strong className="text-brand-text">Rounds:</strong> The competition will be conducted in <strong className="text-brand-text">three rounds</strong>.</li>
                            <li className={detailItem}><strong className="text-brand-text">Team Size:</strong> Participation is limited to teams of up to <strong className="text-brand-text">Three</strong> individuals (Students from UG/PG/PhD backgrounds).</li>
                        </ul>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-8">
                        <Card>
                            <h3 className="text-xl font-bold mb-4">Round 1 (Online)</h3>
                            <ul className="space-y-3 text-brand-text-dark">
                                <li><strong>Objective:</strong> Screening round with MCQs, aptitude, and basic coding questions.</li>
                                <li><strong>Mode:</strong> Online</li>
                                <li><strong>Date:</strong> Jan 12, 2026</li>
                                <li><strong>Duration:</strong> 60 Minutes</li>
                                <li><strong>Qualification:</strong> Top performers securing 50% marks.</li>
                            </ul>
                        </Card>
                         <Card>
                            <h3 className="text-xl font-bold mb-4">Round 2 (Online)</h3>
                             <ul className="space-y-3 text-brand-text-dark">
                                <li><strong>Objective:</strong> Problem statements based on coding and AI/ML application.</li>
                                <li><strong>Mode:</strong> Online</li>
                                <li><strong>Date:</strong> Feb 3, 2026</li>
                                <li><strong>Duration:</strong> 4 hours from the start of the round.</li>
                            </ul>
                        </Card>
                    </div>
                     <Card>
                        <h3 className="text-xl font-bold mb-4">Round 3 (Offline at NIT Silchar Campus)</h3>
                        <ul className="space-y-3 text-brand-text-dark">
                            <li><strong>Objective:</strong> Final hackathon challenge with real-time problem-solving.</li>
                            <li><strong>Mode:</strong> Offline</li>
                            <li><strong>Venue:</strong> NIT Silchar, Assam</li>
                            <li><strong>Date:</strong> Feb 24, 2026</li>
                            <li><strong>Duration:</strong> 48-hour hackathon.</li>
                        </ul>
                    </Card>

                     <Card>
                        <h2 className="text-2xl font-bold text-brand-primary mb-6">Prizes, Recognition & Perks</h2>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-xl font-bold mb-4">Top 3 Winning Teams</h3>
                                <ul className="space-y-3 text-brand-text-dark">
                                    <li><strong>1st Prize:</strong> ₹50,000 + Certificate of Achievement</li>
                                    <li><strong>2nd Prize:</strong> ₹40,000 + Certificate of Achievement</li>
                                    <li><strong>3rd Prize:</strong> ₹30,000 + Certificate of Achievement</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-4">Certificates for Participants</h3>
                                <ul className="space-y-3 text-brand-text-dark">
                                    <li><strong>Participation Certificate:</strong> All registered participants.</li>
                                    <li><strong>Appreciation Certificate:</strong> Top 75% performers.</li>
                                    <li><strong>Outstanding Performance Certificate:</strong> Top 10% of participants (scoring ≥80%).</li>
                                </ul>
                            </div>
                        </div>
                         <div className="mt-8 pt-6 border-t border-white/10">
                            <h3 className="text-xl font-bold mb-4">Additional Perks</h3>
                            <ul className="space-y-3 text-brand-text-dark">
                                <li className={detailItem}><strong className="text-brand-text">Accommodation:</strong> <span className="text-brand-accent">Free accommodation</span> will be provided to participants during the final (offline) round.</li>
                                <li className={detailItem}><strong className="text-brand-text">Local Visit:</strong> Participants will have the opportunity to explore local attractions.</li>
                                <li className={detailItem}><strong className="text-brand-text">Academic Interaction & Gala Dinner:</strong> Engage with esteemed academicians and enjoy the Conference Gala Dinner.</li>
                            </ul>
                         </div>
                    </Card>
                </section>
            </div>
        </PageTransition>
    );
};

const FAQPage = () => {
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);
    const faqs = [
        { q: "Who can participate?", a: "The hackathon is open to all UG/PG/PhD students from any discipline across the nation." },
        { q: "What is the team size?", a: "Teams can consist of 1 to 3 members. Lone wolves are welcome!" },
        { q: "Is there a registration fee?", a: "Yes, there is a nominal registration fee of Rs. 2000 per team to cover event costs." },
        { q: "What is the theme of the hackathon?", a: "Participants will tackle real-world problems using AI, machine learning, and other emerging technologies. Specific problem statements will be released during the rounds." },
        { q: "What technologies can we use?", a: "You are free to use any programming language, framework, or technology stack you are comfortable with. Innovation is key!" },
        { q: "How will the projects be judged?", a: "Projects will be judged based on creativity, technical complexity, user experience, and the potential impact of the solution." },
        { q: "Is there any support available during the hackathon?", a: "Yes, mentors from academia and industry will be available to guide teams throughout the event." }
    ];

    return (
        <PageTransition>
            <div className="min-h-screen pt-24 md:pt-28 pb-10">
                <section className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-secondary to-brand-primary text-transparent bg-clip-text mb-4">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-lg md:text-xl text-brand-text-dark">
                        Everything you need to know about CodeAstra 2026.
                    </p>
                </section>
                <section>
                    <div className="max-w-4xl mx-auto space-y-4">
                        {faqs.map((faq, index) => (
                            <div key={index} className="glassmorphism rounded-lg overflow-hidden">
                                <button onClick={() => setOpenFAQ(openFAQ === index ? null : index)} className="w-full flex justify-between items-center p-5 text-left font-semibold text-brand-text">
                                    <span>{faq.q}</span>
                                    <motion.span animate={{ rotate: openFAQ === index ? 180 : 0 }} transition={{ duration: 0.3 }}>
                                        <ChevronDown/>
                                    </motion.span>
                                </button>
                                <AnimatePresence>
                                    {openFAQ === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="p-5 pt-0 text-brand-text-dark">{faq.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </PageTransition>
    );
};

const ContactPage = () => {
    return (
        <PageTransition>
            <div className="min-h-screen pt-24 md:pt-28 pb-10">
                <section className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-secondary to-brand-primary text-transparent bg-clip-text mb-4">
                        Get In Touch
                    </h1>
                    <p className="text-lg md:text-xl text-brand-text-dark max-w-2xl mx-auto">
                        Have a question that's not in the FAQ? We're here to help. Reach out to the appropriate contact points below.
                    </p>
                </section>
                <section className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
                    <Card className="h-full">
                        <h3 className="text-2xl font-bold mb-4 flex items-center">
                            <UserCircleIcon className="w-8 h-8 mr-3 text-brand-primary"/>
                            General Queries
                        </h3>
                        <div className="space-y-3 text-brand-text-dark">
                            <p>For any doubts or queries regarding registration, rules, or event logistics, please contact the Class Representatives (CRs).</p>
                            <div className="pt-2">
                                <p className="font-semibold text-brand-text">B.Tech CSE, 3rd Year</p>
                                <p>NIT Silchar</p>
                            </div>
                             <div className="pt-2">
                                <p className="font-semibold text-brand-text">Primary Contact:</p>
                                <a href="mailto:queries@codeastra.com" className="hover:text-brand-primary transition-colors">codeastra26@gmail.com</a>
                            </div>
                        </div>
                    </Card>
                    <Card className="h-full">
                         <h3 className="text-2xl font-bold mb-4 flex items-center">
                            <AcademicCapIcon className="w-8 h-8 mr-3 text-brand-primary"/>
                            Sponsorship & Media
                        </h3>
                         <div className="space-y-3 text-brand-text-dark">
                            <p>For partnership opportunities, media inquiries, or sponsorship details, please reach out to our organizing committee.</p>
                             <div className="pt-2">
                                <p className="font-semibold text-brand-text">Organizing Committee</p>
                                <p>CodeAstra 2026</p>
                            </div>
                            <div className="pt-2">
                                <p className="font-semibold text-brand-text">Partnerships Contact:</p>
                                <a href="mailto:partners@codeastra.com" className="hover:text-brand-primary transition-colors">codeastra26@gmail.com</a>
                            </div>
                        </div>
                    </Card>
                </section>
            </div>
        </PageTransition>
    );
};

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [shouldRedirect, setShouldRedirect] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (shouldRedirect && user && user.role) {
            navigate(user.role === "admin" ? "/admin" : "/dashboard");
            setShouldRedirect(false);
        }
    }, [shouldRedirect, user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
            setShouldRedirect(true);
        } catch (err: any) {
            setError(err.message || "Login failed.");
            setIsLoading(false);
        }
    };




    return (
        <PageTransition>
            <div className="flex items-center justify-center min-h-screen pt-20">
                <Card className="w-full max-w-md">
                    <h2 className="text-3xl font-bold text-center mb-6">Login</h2>
                    {error && <p className="bg-red-600/20 text-red-400 p-3 rounded-lg mb-4">{error}</p>}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50" />
                        <button type="submit" disabled={isLoading} className="w-full bg-brand-secondary text-brand-dark font-bold py-3 rounded-lg transition-opacity duration-300 animate-glow-secondary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isLoading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </Card>
            </div>
        </PageTransition>
    );
};

const RegisterPage = () => {
    const initialFormState = {
        members: [{ name: '', age: '', college: '' }],
        leaderEmail: '',
        password: '',
        transactionId: '',
    };
    const [formState, setFormState] = useState(() => {
        try {
            const savedState = sessionStorage.getItem('registrationForm');
            return savedState ? JSON.parse(savedState) : initialFormState;
        } catch {
            return initialFormState;
        }
    });
    const [consents, setConsents] = useState({ rules: false, data: false });
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [success, setSuccess] = useState(false);
    const { registerTeam, db } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        sessionStorage.setItem('registrationForm', JSON.stringify(formState));
    }, [formState]);
    
    useEffect(() => {
        if (!db?.adminState?.registrations_open) {
            navigate('/');
        }
    }, [db?.adminState?.registrations_open, navigate]);
    
    const handleFormChange = (field: keyof typeof initialFormState, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const handleMemberChange = (index: number, field: keyof TeamMember, value: string) => {
        const newMembers = [...formState.members];
        newMembers[index][field] = value;
        handleFormChange('members', newMembers);
    };

    const addMember = () => {
        if (formState.members.length < 3) {
            handleFormChange('members', [...formState.members, { name: '', age: '', college: '' }]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!consents.rules || !consents.data) {
            setErrorMessage('Please agree to the terms and consent to data usage before submitting.');
            setShowErrorModal(true);
            return;
        }
        if (db?.teams?.some(t => t.leaderEmail === formState.leaderEmail)) {
            setErrorMessage('An account with this email already exists. Please use a different email.');
            setShowErrorModal(true);
            return;
        }

        console.log('[RegisterPage] Submitting registration for:', formState.leaderEmail);

        registerTeam({
            leaderEmail: formState.leaderEmail,
            passwordHash: formState.password,
            members: formState.members,
            transactionId: formState.transactionId
        }).then((newTeam) => {
            console.log('[RegisterPage] Registration successful:', newTeam);
            setSuccess(true);
            sessionStorage.removeItem('registrationForm');
        }).catch((error) => {
            console.error('[RegisterPage] Registration failed:', error);
            setErrorMessage(error.message || 'Registration failed. Please try again.');
            setShowErrorModal(true);
        });
    };

    if (success) {
        return (
            <PageTransition>
                <div className="flex items-center justify-center min-h-screen pt-20">
                    <Card className="w-full max-w-md text-center">
                        <CheckCircleIcon />
                        <h2 className="text-2xl font-bold mt-4">Registration Submitted!</h2>
                        <p className="text-brand-text-dark mt-2">Your application is pending approval. You will be able to log in once the admin verifies your payment details.</p>
                        <Link to="/" className="mt-6 inline-block bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Back to Home</Link>
                    </Card>
                </div>
            </PageTransition>
        );
    }
    
    return (
        <PageTransition>
            <div className="flex items-center justify-center min-h-screen pt-24 md:pt-28 pb-10">
                <Card className="w-full max-w-3xl">
                    <h2 className="text-3xl font-bold text-center mb-6">Register Your Team</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {formState.members.map((member, index) => (
                            <div key={index} className="p-4 border border-white/20 rounded-lg">
                                <h3 className="font-semibold text-lg mb-2">{index === 0 ? "Team Leader" : `Member ${index + 1}`}</h3>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <input type="text" placeholder="Full Name" value={member.name} onChange={e => handleMemberChange(index, 'name', e.target.value)} required className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                                    <input type="number" placeholder="Age" value={member.age} onChange={e => handleMemberChange(index, 'age', e.target.value)} required className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                                    <input type="text" placeholder="College/Institution" value={member.college} onChange={e => handleMemberChange(index, 'college', e.target.value)} required className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                                </div>
                            </div>
                        ))}
                        {formState.members.length < 3 && <button type="button" onClick={addMember} className="text-brand-primary font-semibold">+ Add Member</button>}

                        <div className="grid md:grid-cols-2 gap-4">
                            <input type="email" placeholder="Team Leader's Email" value={formState.leaderEmail} onChange={e => handleFormChange('leaderEmail', e.target.value)} required className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                            <input type="password" placeholder="Set Password" value={formState.password} onChange={e => handleFormChange('password', e.target.value)} required className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                        </div>

                        <div className="p-4 border border-brand-primary/30 rounded-lg bg-brand-surface/50 text-center">
                            <h3 className="font-semibold text-lg mb-2 text-brand-primary">Payment Details</h3>
                            <p className="text-brand-text-dark">Registration Fee: <strong className="text-brand-text">Rs. 2000 per team</strong></p>
                            <div className="mt-3 text-left space-y-1 max-w-xs mx-auto">
                                <p><strong>Account Holder:</strong> YYYY</p>
                                <p><strong>Account Number:</strong> XXX</p>
                                <p><strong>Bank:</strong> SBI, Branch: NIT Silchar</p>
                                <p><strong>IFSC Code:</strong> SBIN0007061</p>
                                <p><strong>MICR Code:</strong> 788002004</p>
                            </div>
                        </div>

                        <input type="text" placeholder="Transaction ID for Registration Fee" value={formState.transactionId} onChange={e => handleFormChange('transactionId', e.target.value)} required className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                        
                        <div className="space-y-2">
                           <CustomCheckbox id="rules" checked={consents.rules} onChange={e => setConsents({...consents, rules: e.target.checked})}>
                                I have read and agree to the
                                <Link to="/details" className="text-brand-primary underline hover:text-brand-secondary ml-1">rules and regulations</Link>.
                           </CustomCheckbox>
                           <CustomCheckbox id="data" checked={consents.data} onChange={e => setConsents({...consents, data: e.target.checked})}>I consent to the use of my data for event purposes.</CustomCheckbox>
                        </div>

                        <button type="submit" className="w-full bg-brand-secondary text-brand-dark font-bold py-3 rounded-lg transition-opacity duration-300 animate-glow-secondary hover:opacity-90">Submit Registration</button>
                    </form>
                </Card>
            </div>
             <Modal isOpen={showErrorModal} onClose={() => setShowErrorModal(false)}>
                <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
                <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Registration Error</h3>
                <p className="text-brand-text-dark">{errorMessage}</p>
                <button onClick={() => setShowErrorModal(false)} className="mt-6 bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Got it</button>
            </Modal>
        </PageTransition>
    );
};

const StatusTimeline = ({ status }: { status: TeamStatus }) => {
    const steps = [
        { name: 'Registered', icon: DocumentTextIcon, statuses: ['pending', 'approved', 'deleted', 'disqualified_round1', 'qualified_round2', 'disqualified_round2', 'qualified_round3', 'finalist', 'winner_1', 'winner_2', 'winner_3'] },
        { name: 'Round 1', icon: BeakerIcon, statuses: ['approved', 'disqualified_round1', 'qualified_round2', 'disqualified_round2', 'qualified_round3', 'finalist', 'winner_1', 'winner_2', 'winner_3'] },
        { name: 'Round 2', icon: ClipboardListIcon, statuses: ['qualified_round2', 'disqualified_round2', 'qualified_round3', 'finalist', 'winner_1', 'winner_2', 'winner_3'] },
        { name: 'Finals', icon: FlagIcon, statuses: ['qualified_round3', 'finalist', 'winner_1', 'winner_2', 'winner_3'] },
        { name: 'Winner', icon: TrophyIcon, statuses: ['winner_1', 'winner_2', 'winner_3'] }
    ];

    let activeIndex = -1;
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].statuses.includes(status)) {
            activeIndex = i;
            break;
        }
    }
    console.log(`[StatusTimeline] status: ${status}, activeIndex: ${activeIndex}`);
    const isDisqualified = (status || '').startsWith('disqualified') || status === 'deleted';

    return (
        <div className="flex items-center justify-between relative">
            {steps.map((step, index) => {
                const isCompleted = activeIndex > index;
                const isActive = activeIndex === index;
                
                let state: 'completed' | 'active' | 'pending' | 'failed' = 'pending';
                if(isCompleted) state = 'completed';
                if(isActive) state = 'active';
                if (isDisqualified && isActive) state = 'failed';
                
                const iconColor = state === 'completed' ? 'text-brand-primary' : state === 'active' ? 'text-brand-secondary' : state === 'failed' ? 'text-red-600' : 'text-brand-text-dark';
                const textColor = state === 'completed' || state === 'active' ? 'text-brand-text' : state === 'failed' ? 'text-red-500' : 'text-brand-text-dark';
                const ringColor = state === 'active' ? 'ring-brand-secondary' : state === 'completed' ? 'ring-brand-primary' : state === 'failed' ? 'ring-red-600' : 'ring-brand-surface';

                return (
                    <React.Fragment key={step.name}>
                        <div className="z-10 flex flex-col items-center text-center w-16 sm:w-20">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ring-2 ${ringColor} bg-brand-surface`}>
                                <step.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${textColor}`}>{step.name}</p>
                        </div>
                        {index < steps.length - 1 && (
                             <div className="flex-1 h-1 bg-brand-surface">
                                <div className={`h-full transition-all duration-500 ${index < activeIndex ? (isDisqualified && index + 1 === activeIndex ? 'w-full bg-red-600' : 'w-full bg-brand-primary') : 'w-0'}`}></div>
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const WinnerCard = ({ rank }: { rank: '1' | '2' | '3' }) => {
    const details = {
        '1': {
            place: '1st Place Winner',
            color: 'text-brand-primary',
            shadow: 'shadow-[0_0_40px_#FF00FF,0_0_80px_#FF00FF]',
            glow: 'animate-glow-primary',
            border: 'border-2 border-brand-primary/50',
            bg: 'bg-gradient-to-br from-brand-primary/10 to-purple-600/10'
        },
        '2': {
            place: '2nd Place Winner',
            color: 'text-brand-secondary',
            shadow: 'shadow-[0_0_40px_#00E5FF,0_0_80px_#00E5FF]',
            glow: 'animate-glow-secondary',
            border: 'border-2 border-brand-secondary/50',
            bg: 'bg-gradient-to-br from-brand-secondary/10 to-blue-400/10'
        },
        '3': {
            place: '3rd Place Winner',
            color: 'text-brand-tertiary',
            shadow: 'shadow-[0_0_40px_#FF8C00,0_0_80px_#FF8C00]',
            glow: 'animate-pulse',
            border: 'border-2 border-brand-tertiary/50',
            bg: 'bg-gradient-to-br from-brand-tertiary/10 to-yellow-600/10'
        },
    };
    return (
          <Card className={`text-center ${details[rank].bg} ${details[rank].shadow} ${details[rank].border} ${details[rank].glow} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
            <TrophyIcon className={`w-28 h-28 mx-auto ${details[rank].color} animate-bounce-gentle drop-shadow-2xl`} />
            <h2 className="text-4xl font-bold mt-4 text-brand-text animate-fade-in">Congratulations!</h2>
            <p className={`text-2xl font-semibold mt-2 ${details[rank].color} animate-slide-up`}>{details[rank].place} of CodeAstra 2026!</p>
            <div className="mt-4 flex justify-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${rank === '1' ? 'bg-brand-primary' : rank === '2' ? 'bg-brand-secondary' : 'bg-brand-tertiary'} animate-ping`}></div>
                <div className={`w-3 h-3 rounded-full ${rank === '1' ? 'bg-brand-primary' : rank === '2' ? 'bg-brand-secondary' : 'bg-brand-tertiary'} animate-ping animation-delay-300`}></div>
                <div className={`w-3 h-3 rounded-full ${rank === '1' ? 'bg-brand-primary' : rank === '2' ? 'bg-brand-secondary' : 'bg-brand-tertiary'} animate-ping animation-delay-600`}></div>
            </div>
        </Card>
    );
};

const Leaderboard = () => {
    const { db } = useAuth();

    const winners = (db?.teams || []).filter(t => (t.status || '').startsWith('winner_')).sort((a, b) => {
        const rankA = parseInt((a.status || '').split('_')[1] || '0');
        const rankB = parseInt((b.status || '').split('_')[1] || '0');
        return rankA - rankB;
    });

    if (winners.length === 0) return null;

    const rankDetails = {
        '1': {
            iconColor: 'text-brand-primary',
            bgColor: 'bg-gradient-to-r from-brand-primary/20 to-purple-600/20',
            borderColor: 'border-brand-primary/50',
            shadow: 'shadow-[0_0_20px_#FF00FF]',
            glow: 'animate-glow-primary'
        },
        '2': {
            iconColor: 'text-brand-secondary',
            bgColor: 'bg-gradient-to-r from-brand-secondary/20 to-blue-400/20',
            borderColor: 'border-brand-secondary/50',
            shadow: 'shadow-[0_0_20px_#00E5FF]',
            glow: 'animate-glow-secondary'
        },
        '3': {
            iconColor: 'text-brand-tertiary',
            bgColor: 'bg-gradient-to-r from-brand-tertiary/20 to-yellow-600/20',
            borderColor: 'border-brand-tertiary/50',
            shadow: 'shadow-[0_0_20px_#FF8C00]',
            glow: 'animate-pulse'
        },
    };

    return (
        <Card>
            <h2 className="text-2xl font-bold mb-4 flex items-center">
                <TrophyIcon className="w-8 h-8 mr-3 text-brand-primary"/>
                Final Leaderboard
            </h2>

            {/* Mobile Card Layout */}
            <div className="block md:hidden space-y-4">
                {winners.map(team => {
                    const rank = ((team.status || '').split('_')[1] || '1') as '1' | '2' | '3';
                    const details = rankDetails[rank];
                    return (
                        <div key={team.id} className={`p-4 rounded-lg border-2 ${details?.bgColor || 'bg-brand-surface'} ${details?.borderColor || 'border-brand-surface'} ${details?.shadow || ''} ${details?.glow || ''} transition-all duration-300 hover:scale-[1.02]`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <TrophyIcon className={`w-8 h-8 ${details?.iconColor || 'text-brand-text'} drop-shadow-lg`} />
                                    <div>
                                        <div className="text-2xl font-bold">{rank}</div>
                                        <div className="text-sm text-brand-text-dark">Place</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-lg">{team.members?.[0]?.name || ''}</div>
                                    <div className="text-sm text-brand-text-dark">{team.members?.[0]?.college || ''}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 font-semibold">Rank</th>
                            <th className="text-left py-3 px-4 font-semibold">Team Leader</th>
                            <th className="text-left py-3 px-4 font-semibold">College</th>
                        </tr>
                    </thead>
                    <tbody>
                        {winners.map(team => {
                            const rank = ((team.status || '').split('_')[1] || '1') as '1' | '2' | '3';
                            const details = rankDetails[rank];
                            return (
                            <tr key={team.id} className={`border-b border-white/5 hover:bg-brand-surface/30 transition-colors ${details?.glow || ''}`}>
                                <td className="py-4 px-4">
                                    <div className="flex items-center gap-3">
                                        <TrophyIcon className={`w-6 h-6 ${details?.iconColor || 'text-brand-text'} drop-shadow-lg`} />
                                        <span className="font-bold text-lg">{rank}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-4 font-medium">{team.members?.[0]?.name || ''}</td>
                                <td className="py-4 px-4 text-brand-text-dark">{team.members?.[0]?.college || ''}</td>
                            </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};


const DashboardPage = () => {
    const { user, db } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showR2Warning, setShowR2Warning] = useState(false);
    const team = db?.teams?.find(t => t.id === user?.teamId);
    const status = team?.status || 'pending';

    useEffect(() => {
        console.log(`[DashboardPage] Updated - team status: ${team?.status}, resolved status: ${status}, round1_started: ${db?.adminState?.round1_started}, teams count: ${db?.teams?.length}`);
        console.log('[DashboardPage] team object:', team);
    }, [team?.status, status, db?.adminState?.round1_started, db?.teams?.length]);

    if (!team) {
        return <Navigate to="/login" />;
    }

    const getStatusMessage = () => {
        if (status === 'deleted') {
            return "Your application has been rejected. We appreciate your interest and encourage you to join us for future events.";
        }
        if ((status || '').startsWith('disqualified')) {
            const appreciation = "We appreciate your hard work and encourage you to join us for future events.";
            switch(team.disqualificationReason) {
                case 'cheating': return `You have been disqualified for violating test rules by navigating away from the test page. ${appreciation}`;
                case 'missed_test': return `You did not complete the test in time and have been disqualified. ${appreciation}`;
                case 'did_not_qualify': return `You did not qualify for the next round. ${appreciation}`;
                default: return `You are disqualified. ${appreciation}`;
            }
        }
        switch (status) {
            case 'pending': return "Your registration is pending approval. We're verifying your details.";
            case 'approved':
                if (team.round1Submission) {
                    return "Your Round 1 test has been submitted. Results will be announced soon. Good luck!";
                }
                return "You're all set for Round 1! All the best.";
            case 'qualified_round2':
                  if (team.round2Submission) {
                    return "Your Round 2 project has been submitted. Results will be announced soon. Good luck!";
                }
                return "Congratulations! You've advanced to Round 2. The challenge awaits.";
            case 'qualified_round3': return "Amazing! You are a finalist. See you at the offline event!";
            case 'winner_1':
            case 'winner_2':
            case 'winner_3':
                return "Congratulations! You are a winner of CodeAstra 2026! Your exceptional talent and dedication have paid off. We are thrilled to have you as part of our champion team.";
            case 'finalist': return "Congratulations on reaching the finals! While you didn't secure a top-three position, your achievement in making it this far is truly remarkable. We extend our heartfelt appreciation for your incredible hard work and dedication throughout CodeAstra 2026. You are a star in our coding community!";
            default: return "Welcome to your dashboard.";
        }
    };
    
    const canTakeRound1 = db?.adminState?.round1_started && status === 'approved' && !team.round1Submission;
    const canTakeRound2 = db?.adminState?.round2_started && status === 'qualified_round2' && !team.round2Submission;
    const isWinner = (status || '').startsWith('winner');
    const isDisqualified = (status || '').startsWith('disqualified');

    const isRound1Visible = ['approved', 'disqualified_round1', 'qualified_round2', 'disqualified_round2', 'qualified_round3', 'finalist', 'winner_1', 'winner_2', 'winner_3'].includes(status);
    const isQualifiedForRound2 = ['qualified_round2', 'disqualified_round2', 'qualified_round3', 'finalist', 'winner_1', 'winner_2', 'winner_3'].includes(status);
    const isQualifiedForRound3 = ['qualified_round3', 'finalist', 'winner_1', 'winner_2', 'winner_3'].includes(status);

    const navItems = [
        { id: 'home', label: 'Home', icon: HomeIcon, visible: true, disabled: false },
        { id: 'round1', label: 'Round 1', icon: BeakerIcon, visible: isRound1Visible, disabled: false },
        { id: 'round2', label: 'Round 2', icon: ClipboardListIcon, visible: isRound1Visible, disabled: !isQualifiedForRound2 || !db?.adminState?.round2_started },
        { id: 'round3', label: 'Round 3', icon: FlagIcon, visible: isRound1Visible, disabled: !isQualifiedForRound3 },
    ];
    
    const round1McqCount = db?.adminState?.round1_questions.filter(q => q.type === 'mcq').length;
    const round1CodingCount = db?.adminState?.round1_questions.filter(q => q.type === 'coding').length;
    const round1TotalCount = round1McqCount + round1CodingCount;

    const handleNavClick = (viewId: string) => {
        setView(viewId);
        setIsSidebarOpen(false);
    };

    return (
        <PageTransition>
            <div className="flex min-h-screen pt-16 md:pt-20">
                {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden"></div>}
                
                <aside className={`fixed lg:relative inset-y-0 left-0 w-64 flex-shrink-0 p-4 bg-brand-dark/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-0 z-40 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                    <div className="sticky top-20 md:top-24">
                        <h2 className="text-2xl font-bold mb-4 px-3">Team Menu</h2>
                        <div className="glassmorphism rounded-xl p-3">
                            <nav className="flex flex-col space-y-2">
                                {navItems.map(item => item.visible && (
                                    <button 
                                        key={item.id} 
                                        onClick={() => !item.disabled && handleNavClick(item.id)} 
                                        disabled={item.disabled}
                                        className={`flex items-center p-3 rounded-lg transition-colors w-full ${view === item.id ? 'bg-brand-secondary/20 text-brand-secondary' : 'hover:bg-brand-surface'} ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <item.icon className="w-5 h-5 mr-3"/>
                                        <span className="font-semibold">{item.label}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 p-4">
                     <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 mb-4 rounded-lg bg-brand-surface fixed top-20 left-4 z-20">
                        <MenuIcon />
                     </button>
                     <div className="max-w-6xl mx-auto space-y-8 pt-12">
                        {view === 'home' && (
                            <>
                                <h1 className="text-2xl md:text-4xl font-bold">Welcome, {team.members?.[0]?.name || 'Participant'}!</h1>
                                {isWinner && db?.adminState?.round3_results_visible && <WinnerCard rank={status.split('_')[1] as '1' | '2' | '3'} />}
                                {db?.adminState?.round3_results_visible && <Leaderboard />}
                                <Card>
                                    <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center">
                                        <CheckBadgeIcon className="w-5 md:w-6 h-5 md:h-6 mr-3 text-brand-primary"/>
                                        Current Status
                                    </h2>
                                    <StatusTimeline status={status} />
                                    <div className={`mt-6 p-3 md:p-4 rounded-lg border-l-4 ${isDisqualified ? 'bg-red-600/20 border-red-600' : 'bg-brand-surface/80 border-brand-primary'}`}>
                                        <p className={`font-semibold text-sm md:text-base ${isDisqualified ? 'text-red-400' : 'text-brand-text'}`}>{getStatusMessage()}</p>
                                        {!team?.status && status === 'pending' && (process.env.NODE_ENV !== 'production' || window.location.search.includes('dev=true')) && (
                                            <p className="text-xs text-yellow-400 mt-2">[Dev] Status was auto-filled to &apos;pending&apos; (missing in Firestore)</p>
                                        )}
                                    </div>
                                </Card>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                    <Card>
                                        <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center">
                                            <UsersIcon className="w-5 md:w-6 h-5 md:h-6 mr-3 text-brand-primary"/>
                                            Team Details
                                        </h2>
                                        <ul className="space-y-3">
                                            {team.members.map((member, index) => (
                                                <li key={index} className="p-2 md:p-3 bg-brand-dark rounded-lg">
                                                    <p className="font-bold text-sm md:text-base">{member.name} {index === 0 && <span className="text-xs font-semibold text-brand-primary/80">(Leader)</span>}</p>
                                                    <p className="text-xs md:text-sm text-brand-text-dark">{member.college}</p>
                                                    <p className="text-xs md:text-sm text-brand-text-dark">Age: {member.age}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </Card>
                                    <Card>
                                         <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center">
                                            <CogIcon className="w-5 md:w-6 h-5 md:h-6 mr-3 text-brand-primary"/>
                                            Quick Actions
                                        </h2>
                                        <div className="space-y-2 md:space-y-3">
                                            {canTakeRound1 && <Link to="/test/round1" className="block text-center font-bold py-2 md:py-3 px-4 md:px-6 text-sm md:text-base rounded-lg bg-brand-primary text-brand-dark animate-glow-primary">Take Round 1 Test</Link>}
                                            {canTakeRound2 && <button onClick={() => setShowR2Warning(true)} className="w-full text-center font-bold py-2 md:py-3 px-4 md:px-6 text-sm md:text-base rounded-lg bg-brand-primary text-brand-dark animate-glow-primary">Start Round 2 Project</button>}
                                            {!canTakeRound1 && !canTakeRound2 && <p className="text-brand-text-dark text-center py-3 md:py-4 text-xs md:text-sm">No active tasks at the moment. Please check back later for updates.</p>}
                                        </div>
                                    </Card>
                                 </div>
                            </>
                        )}
                        {view === 'round1' && (
                             <div className="grid md:grid-cols-3 gap-8">
                                <div className="md:col-span-2">
                                    <Card>
                                        <h3 className="text-2xl font-bold mb-2">Round 1: Screening Test</h3>
                                        <p className="text-brand-text-dark mb-4">This initial phase is an online screening round to assess foundational knowledge.</p>
                                        {team.round1Submission ? (
                                            <div>
                                                <p className="text-brand-text-dark mt-2">You have completed this round.</p>
                                                {db?.adminState?.round1_results_visible && team.round1Score !== null && <p className="mt-4 text-lg font-semibold">Your Score: <span className="text-brand-primary">{team.round1Score} / {round1TotalCount}</span></p>}
                                            </div>
                                        ) : (
                                            <Link to="/test/round1" className={`mt-4 inline-block font-bold py-2 px-6 rounded-lg ${canTakeRound1 ? 'bg-brand-primary text-brand-dark animate-glow-primary' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>Take Test</Link>
                                        )}
                                    </Card>
                                </div>
                                <Card>
                                    <h3 className="text-xl font-bold mb-4">Round Details</h3>
                                    <ul className="space-y-3 text-brand-text-dark">
                                        <li><strong>Questions:</strong> {round1McqCount} MCQs & {round1CodingCount} Coding</li>
                                        <li><strong>Time Limit:</strong> 60 Minutes</li>
                                        <li><strong>Note:</strong> Navigating away from the test tab will result in disqualification.</li>
                                    </ul>
                                </Card>
                            </div>
                        )}
                         {view === 'round2' && (
                             <div className="grid md:grid-cols-3 gap-8">
                                <div className="md:col-span-2">
                                    <Card>
                                        <h3 className="text-2xl font-bold mb-2">Round 2: AI/ML Challenge</h3>
                                        <p className="text-brand-text-dark mb-4">This round involves solving a complex problem statement based on coding and AI/ML applications, requiring you to build and submit a complete project.</p>
                                        {team.round2Submission ? (
                                            <div>
                                                <p className="text-brand-text-dark mt-2">You have completed this round.</p>
                                                {team.round2Submission.repoLink && <p className="mt-2 text-sm text-brand-text-dark">Submitted Repository: <a href={team.round2Submission.repoLink} target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">View on GitHub</a></p>}
                                                {db?.adminState?.round2_results_visible && team.round2Grade !== null && <p className="mt-4 text-lg font-semibold">Your Grade: <span className="text-brand-primary">{team.round2Grade} / 100</span></p>}
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowR2Warning(true)} disabled={!canTakeRound2} className={`mt-4 inline-block font-bold py-2 px-6 rounded-lg ${canTakeRound2 ? 'bg-brand-primary text-brand-dark animate-glow-primary' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>View Problem & Submit</button>
                                        )}
                                    </Card>
                                </div>
                                <Card>
                                     <h3 className="text-xl font-bold mb-4">Round Details</h3>
                                    <ul className="space-y-3 text-brand-text-dark">
                                        <li><strong>Task:</strong> Project Submission</li>
                                        <li><strong>Format:</strong> GitHub Repository Link</li>
                                        <li><strong>Deadline:</strong> 48 hours from start.</li>
                                        <li><strong>Evaluation:</strong> Manual grading by judges based on creativity, complexity, and impact.</li>
                                    </ul>
                                </Card>
                            </div>
                        )}
                        {view === 'round3' && (
                             <Card>
                                <h3 className="text-2xl font-bold mb-2">Round 3: Offline Finale</h3>
                                <p className="text-brand-text-dark mt-2">The final round is an intense, in-person hackathon at NIT Silchar, Assam, focused on real-time problem-solving. More details regarding travel and accommodation will be sent to your registered email.</p>
                                {db?.adminState?.round3_results_visible && team.round3Result && <p className="mt-4 text-lg font-semibold">Final Result: <span className="text-brand-primary">{team.round3Result} Place</span></p>}
                            </Card>
                        )}
                    </div>
                </main>
                <Modal isOpen={showR2Warning} onClose={() => setShowR2Warning(false)}>
                    <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
                    <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Round 2 Instructions</h3>
                    <p className="text-brand-text-dark">The project repository link should be submitted within <strong className="text-brand-text">4 hours</strong> of the start of Round 2. Are you ready to view the problem statement and begin?</p>
                    <div className="mt-6 flex justify-center space-x-4">
                          <button onClick={() => setShowR2Warning(false)} className="bg-brand-surface hover:bg-brand-surface/80 text-white font-bold py-2 px-6 rounded-lg">Cancel</button>
                          <button onClick={() => navigate('/test/round2')} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Proceed</button>
                    </div>
                </Modal>
            </div>
        </PageTransition>
    );
};

const AdminDashboard = () => {
    console.log('🔧 AdminDashboard component mounted');
    const { db, updateTeam, updateAdminState, user } = useAuth();

    console.log('[AdminDashboard] db.teams:', db?.teams?.length, 'teams');
    console.log('[AdminDashboard] user:', user);

    // Guard: Wait for db to load, but allow admin to proceed even if adminState is missing
    if (!db || !db.teams) {
        console.log('[AdminDashboard] Waiting for data...');
        return <div className="min-h-screen flex items-center justify-center">Loading admin data...</div>;
    }

    // If adminState is missing but user is admin, initialize it
    const adminState = db.adminState || INITIAL_DB.adminState;
    if (!db.adminState && user?.role === 'admin') {
        console.log('AdminState missing, initializing...');
        updateAdminState(adminState);
    }

    // Memoize expensive calculations
    const stats = useMemo(() => ({
        total: db?.teams?.filter(t => t.status !== 'deleted').length || 0,
        pending: db?.teams?.filter(t => t.status === 'pending').length || 0,
        approved: db?.teams?.filter(t => t.status === 'approved').length || 0,
        r1Participants: db?.teams?.filter(t => t.status !== 'deleted' && t.round1Submission?.endTime).length || 0,
        r2Participants: db?.teams?.filter(t => t.status !== 'deleted' && t.round2Submission?.endTime).length || 0,
    }), [db?.teams]);

    const round1McqCount = useMemo(() => adminState?.round1_questions?.filter(q => q.type === 'mcq').length || 0, [adminState?.round1_questions]);
    const round1CodingCount = useMemo(() => adminState?.round1_questions.filter(q => q.type === 'coding').length || 0, [adminState?.round1_questions]);
    const round1TotalCount = useMemo(() => round1McqCount + round1CodingCount, [round1McqCount, round1CodingCount]);

    useEffect(() => {
        console.log('[AdminDashboard] mount/update - db:', db);
    }, [db]);
    const [view, setView] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [questionType, setQuestionType] = useState<'mcq' | 'coding'>('mcq');
    const [showCloseRegModal, setShowCloseRegModal] = useState(false);
    const [adminModal, setAdminModal] = useState<{ isOpen: boolean; type: 'info' | 'success' | 'error'; title?: string; message?: string }>({ isOpen: false, type: 'info', message: '' });
    const [adminConfirm, setAdminConfirm] = useState<{ isOpen: boolean; action?: string; payload?: any }>({ isOpen: false });

    const initialNewQuestionState: any = {
        type: 'mcq',
        question: '',
        options: ['', '', '', ''],
        correctOption: 0,
        testCases: [{ input: '', output: '' }],
        boilerplate: { javascript: '', python: '', java: '', cpp: '', c: '' }
    };

    const [newQuestion, setNewQuestion] = useState(() => ({ ...initialNewQuestionState, type: questionType }));

    useEffect(() => {
        setNewQuestion(prev => ({ ...prev, type: questionType }));
    }, [questionType]);

    const approveTeam = useCallback((teamId: string) => updateTeam(teamId, { status: 'approved' }), [updateTeam]);

    const deleteTeam = useCallback(async (teamId: string) => {
        if (window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
            try {
                await updateTeam(teamId, { status: 'deleted' });
                // Note: In a real app, you might want to actually delete from Firestore
                // For now, we'll just mark as deleted to maintain data integrity
            } catch (error) {
                console.error('Error deleting team:', error);
            }
        }
    }, [updateTeam]);

    const handleNewQuestionChange = useCallback((field: string, value: any, index?: number, subfield?: string) => {
        setNewQuestion(prev => {
            if (field === 'options' && index !== undefined) {
                const updatedOptions = [...(prev.options || [])];
                updatedOptions[index] = value;
                return { ...prev, options: updatedOptions };
            }
              if (field === 'boilerplate' && subfield) {
                return { ...prev, boilerplate: { ...prev.boilerplate, [subfield]: value } };
            }
            if (field === 'testCases' && index !== undefined) {
                const updatedTestCases = [...(prev.testCases || [])];
                updatedTestCases[index] = { ...updatedTestCases[index], ...value };
                return { ...prev, testCases: updatedTestCases };
            }
            return { ...prev, [field]: value };
        });
    }, []);

    const addTestCase = () => {
        setNewQuestion(prev => ({ ...prev, testCases: [...(prev.testCases || []), { input: '', output: '' }] }));
    };

    const removeTestCase = (index: number) => {
        setNewQuestion(prev => ({ ...prev, testCases: (prev.testCases || []).filter((_, i) => i !== index) }));
    };

    const handleAddQuestion = () => {
        if (newQuestion.question.trim() === '') {
            setAdminModal({ isOpen: true, type: 'error', title: 'Invalid Question', message: 'Question text cannot be empty.' });
            return;
        }
        if (newQuestion.type === 'mcq' && newQuestion.options.some(o => o.trim() === '')) {
            setAdminModal({ isOpen: true, type: 'error', title: 'Invalid MCQ', message: 'Please fill out all option fields for the MCQ.' });
            return;
        }
        if (newQuestion.type === 'coding' && newQuestion.testCases.some(tc => tc.input.trim() === '' || tc.output.trim() === '')) {
            setAdminModal({ isOpen: true, type: 'error', title: 'Invalid Test Cases', message: 'Please fill out all test case fields for the coding question.' });
            return;
        }
        
        const questionToAdd: Round1Question = newQuestion.type === 'mcq'
            ? { type: 'mcq', question: newQuestion.question, options: newQuestion.options, correctOption: newQuestion.correctOption }
            : { type: 'coding', question: newQuestion.question, testCases: newQuestion.testCases, boilerplate: newQuestion.boilerplate };

        updateAdminState({ round1_questions: [...(db?.adminState?.round1_questions || []), questionToAdd] });
        setNewQuestion(initialNewQuestionState); // Reset form
        setQuestionType('mcq');
    };

    const handleDeleteQuestion = (index: number) => {
        setAdminConfirm({ isOpen: true, action: 'deleteQuestion', payload: index });
    };
    
    const handleGradeChange = (teamId: string, grade: string) => {
        const gradeValue = parseInt(grade, 10);
        if(!isNaN(gradeValue) && gradeValue >= 0 && gradeValue <= 100) {
            updateTeam(teamId, { round2Grade: gradeValue });
        } else if (grade === '') {
            updateTeam(teamId, { round2Grade: null });
        }
    };
    
    const finalizeRound1 = () => {
        const teamsToFinalize = db?.teams?.filter(t => t.status === 'approved') || [];
        const questions = db?.adminState?.round1_questions || [];
        const mcqQuestionsCount = questions.filter(q => q.type === 'mcq').length;
        const codingQuestionsCount = questions.filter(q => q.type === 'coding').length;
        const totalQuestions = mcqQuestionsCount + codingQuestionsCount;

        if (totalQuestions === 0) { setAdminModal({ isOpen: true, type: 'error', title: 'Cannot Finalize', message: 'Cannot finalize: No questions found.' }); return; }

        teamsToFinalize.forEach(team => {
            if (!team.round1Submission?.endTime) {
                updateTeam(team.id, { status: 'disqualified_round1', disqualificationReason: 'missed_test' });
            } else {
                let score = 0;
                team.round1Submission.answers.forEach((ans, index) => {
                    const question = questions[index];
                    if (question && ans !== null) {
                        if (question.type === 'mcq' && typeof ans === 'number' && ans === question.correctOption) {
                            score++;
                        } else if (question.type === 'coding' && typeof ans === 'object' && ans.passed) {
                            score++;
                        }
                    }
                });
                
                updateTeam(team.id, { round1Score: score });

                const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
                if (percentage >= 50) {
                    updateTeam(team.id, { status: 'qualified_round2' });
                } else {
                    updateTeam(team.id, { status: 'disqualified_round1', disqualificationReason: 'did_not_qualify' });
                }
            }
        });
        updateAdminState({ round1_finalized: true, round1_results_visible: true });
        setAdminModal({ isOpen: true, type: 'success', title: 'Round 1 Finalized', message: `${teamsToFinalize.length} teams processed. Round 1 is now finalized and results are visible.` });
    };

    const finalizeRound2 = () => {
        const qualifiedR2Teams = db?.teams?.filter(t => t.status === 'qualified_round2') || [];
        
        const submittedGradedTeams = qualifiedR2Teams
            .filter(t => t.round2Submission?.endTime && t.round2Grade !== null)
            .sort((a, b) => (b.round2Grade || 0) - (a.round2Grade || 0));
        
        const topTeamIds = new Set(submittedGradedTeams.slice(0, db?.adminState?.round3_qualifiers_count).map(t => t.id));

        qualifiedR2Teams.forEach(team => {
            if (!team.round2Submission?.endTime) {
                updateTeam(team.id, { status: 'disqualified_round2', disqualificationReason: 'missed_test' });
            } else {
                if(topTeamIds.has(team.id)) {
                    updateTeam(team.id, { status: 'qualified_round3' });
                } else {
                    updateTeam(team.id, { status: 'disqualified_round2', disqualificationReason: 'did_not_qualify' });
                }
            }
        });

        updateAdminState({ round2_finalized: true, round2_results_visible: true });
        setAdminModal({ isOpen: true, type: 'success', title: 'Round 2 Finalized', message: `Round 2 results finalized and are now visible! Top ${topTeamIds.size} teams have qualified.` });
    };

    const handleRound3Result = (teamId: string, result: string) => {
        let status: TeamStatus = 'finalist';
        if (result === "1st") status = 'winner_1';
        else if (result === "2nd") status = 'winner_2';
        else if (result === "3rd") status = 'winner_3';
        
        const finalResult = result === "Finalist" || result === "" ? null : result as '1st' | '2nd' | '3rd';
        updateTeam(teamId, { round3Result: finalResult, status });
    };
    
    const handleNavClick = (viewId: string) => {
        setView(viewId);
        setIsSidebarOpen(false);
    };

    const navItems = [
        { id: 'home', label: 'Home', icon: HomeIcon },
        { id: 'approval', label: 'Team Approval', icon: UserCheckIcon },
        { id: 'round1', label: 'Round 1 Config', icon: BeakerIcon },
        { id: 'round2', label: 'Round 2 Config', icon: ClipboardListIcon },
        { id: 'results', label: 'Results', icon: TrophyIcon },
    ];
    

    return (
        <PageTransition>
            <div className="flex min-h-screen pt-16 md:pt-20">
                {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden"></div>}

                <aside className={`fixed lg:relative inset-y-0 left-0 w-64 flex-shrink-0 p-4 bg-brand-dark/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-0 z-40 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                    <div className="sticky top-20 md:top-24">
                        <h2 className="text-2xl font-bold mb-4 px-3">Admin Menu</h2>
                        <div className="glassmorphism rounded-xl p-3">
                            <nav className="flex flex-col space-y-2">
                                {navItems.map(item => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => handleNavClick(item.id)} 
                                        className={`flex items-center p-3 rounded-lg transition-colors w-full ${view === item.id ? 'bg-brand-secondary/20 text-brand-secondary' : 'hover:bg-brand-surface'}`}
                                    >
                                        <item.icon className="w-5 h-5 mr-3"/>
                                        <span className="font-semibold">{item.label}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                </aside>
                <main className="flex-1 p-4">
                     <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 mb-4 rounded-lg bg-brand-surface fixed top-20 left-4 z-20">
                        <MenuIcon />
                     </button>
                     <div className="max-w-7xl mx-auto space-y-8 pt-12">
                        {/* Force dev tools for admin debugging */}
                        {true && <DevAdminTools />}
                        {view === 'home' && (
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                <Card>
                                    <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center"><CogIcon className="w-5 md:w-6 h-5 md:h-6 mr-2 text-brand-primary"/>Global Settings</h3>
                                    <div className="flex items-center justify-between p-3 bg-brand-dark rounded-lg">
                                        <div>
                                            <h4 className="font-semibold">Registrations</h4>
                                            <p className={`text-sm ${db?.adminState?.registrations_open ? 'text-green-400' : 'text-red-400'}`}>
                                                Currently {db?.adminState?.registrations_open ? 'OPEN' : 'CLOSED'}
                                            </p>
                                        </div>
                                        {db?.adminState?.registrations_open ? (
                                            <button
                                                onClick={() => setShowCloseRegModal(true)}
                                                className="p-2 px-3 md:px-4 rounded font-semibold text-sm md:text-base transition-all bg-red-600 hover:bg-red-700 text-white"
                                            >
                                                <span className="hidden sm:inline">Close Registrations</span>
                                                <span className="sm:hidden">Close Reg</span>
                                            </button>
                                        ) : (
                                            <button
                                                disabled
                                                title="Registrations are permanently closed and cannot be reopened."
                                                className="p-2 px-3 md:px-4 rounded font-semibold text-sm md:text-base bg-gray-600 text-gray-400 cursor-not-allowed"
                                            >
                                                <span className="hidden sm:inline">Registrations Closed</span>
                                                <span className="sm:hidden">Closed</span>
                                            </button>
                                        )}
                                    </div>
                                </Card>
                                 <Card>
                                     <h3 className="text-xl font-bold mb-4 flex items-center"><ClipboardListIcon className="w-6 h-6 mr-2 text-brand-primary"/>Competition Snapshot</h3>
                                     <div className="grid grid-cols-2 gap-4 text-center">
                                        <div className="bg-brand-dark p-3 rounded-lg">
                                            <p className="text-2xl font-bold text-brand-secondary">{stats.total}</p>
                                            <p className="text-sm text-brand-text-dark">Total Teams</p>
                                        </div>
                                         <div className="bg-brand-dark p-3 rounded-lg">
                                            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                                            <p className="text-sm text-brand-text-dark">Pending Approval</p>
                                        </div>
                                         <div className="bg-brand-dark p-3 rounded-lg">
                                            <p className="text-2xl font-bold text-green-400">{stats.r1Participants}</p>
                                            <p className="text-sm text-brand-text-dark">Round 1 Participants</p>
                                        </div>
                                         <div className="bg-brand-dark p-3 rounded-lg">
                                            <p className="text-2xl font-bold text-brand-primary">{stats.r2Participants}</p>
                                            <p className="text-sm text-brand-text-dark">Round 2 Participants</p>
                                        </div>
                                     </div>
                                </Card>
                                <Card className="lg:col-span-2">
                                    <h3 className="text-xl font-bold mb-4 flex items-center"><CogIcon className="w-6 h-6 mr-2 text-brand-primary"/>Round Controls</h3>
                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="p-4 bg-brand-dark rounded-lg">
                                            <h4 className="font-semibold mb-3 text-center text-lg">Round 1</h4>
                                            <div className="flex justify-center space-x-2">
                                                <button
                                                    onClick={() => updateAdminState({ round1_started: !db?.adminState?.round1_started })}
                                                    disabled={db?.adminState?.registrations_open || db?.adminState?.round1_finalized}
                                                    title={db?.adminState?.registrations_open ? "Close registrations before starting Round 1." : db?.adminState?.round1_finalized ? "Round 1 is already finalized." : ""}
                                                    className={`w-full p-2 rounded font-semibold transition-all ${db?.adminState?.round1_started ? 'bg-red-600/90 hover:bg-red-600 text-white' : 'bg-brand-primary/90 hover:bg-brand-primary text-brand-dark'} ${db?.adminState?.round1_questions.length > 0 && !db?.adminState?.round1_started && !db?.adminState?.round1_finalized ? 'animate-glow-primary' : ''} disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed`}
                                                >
                                                    {db?.adminState?.round1_started ? 'Stop' : 'Start'}
                                                </button>
                                                <button onClick={finalizeRound1} disabled={db?.adminState?.round1_finalized || db?.adminState?.round1_started} title={db?.adminState?.round1_started ? "Stop the round before finalizing." : db?.adminState?.round1_finalized ? "Round 1 is already finalized." : ""} className="w-full p-2 rounded bg-transparent border-2 border-brand-primary font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:border-gray-600 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed">Finalize</button>
                                            </div>
                                            {db?.adminState?.round1_finalized && <p className="text-center text-sm mt-2 text-green-400">Round 1 has been finalized.</p>}
                                        </div>
                                        <div className="p-4 bg-brand-dark rounded-lg">
                                            <h4 className="font-semibold mb-3 text-center text-lg">Round 2</h4>
                                            <div className="flex justify-center space-x-2">
                                                <button onClick={() => updateAdminState({ round2_started: !db?.adminState?.round2_started })} disabled={!db?.adminState?.round1_finalized || db?.adminState?.round2_finalized} title={!db?.adminState?.round1_finalized ? "Finalize Round 1 before starting Round 2." : db?.adminState?.round2_finalized ? "Round 2 is already finalized." : ""} className={`w-full p-2 rounded font-semibold transition-all ${db?.adminState?.round2_started ? 'bg-red-600/90 hover:bg-red-600 text-white' : 'bg-brand-primary/90 hover:bg-brand-primary text-brand-dark'} disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed`}>{db?.adminState?.round2_started ? 'Stop' : 'Start'}</button>
                                                <button onClick={finalizeRound2} disabled={!db?.adminState?.round1_finalized || db?.adminState?.round2_finalized || db?.adminState?.round2_started} title={!db?.adminState?.round1_finalized ? "Finalize Round 1 first." : db?.adminState?.round2_started ? "Stop Round 2 before finalizing." : db?.adminState?.round2_finalized ? "Round 2 is already finalized." : ""} className="w-full p-2 rounded bg-transparent border-2 border-brand-primary font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed">Finalize</button>
                                            </div>
                                            {db?.adminState?.round2_finalized && <p className="text-center text-sm mt-2 text-green-400">Round 2 has been finalized.</p>}
                                        </div>
                                        <div className="p-4 bg-brand-dark rounded-lg">
                                            <h4 className="font-semibold mb-3 text-center text-lg">Finals</h4>
                                            <div className="flex justify-center space-x-2">
                                                <button onClick={() => updateAdminState({ round3_results_visible: true })} disabled={!db?.adminState?.round2_finalized || db?.adminState?.round3_results_visible} title={!db?.adminState?.round2_finalized ? "Finalize Round 2 before publishing final results." : db?.adminState?.round3_results_visible ? "Results have been published and cannot be hidden." : ""} className="w-full p-2 rounded font-bold bg-brand-secondary text-brand-dark transition-all hover:scale-105 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed">{db?.adminState?.round3_results_visible ? 'Results Published' : 'Publish Results'}</button>
                                            </div>
                                            {db?.adminState?.round3_results_visible && <p className="text-center text-sm mt-2 text-green-400">Final results have been published.</p>}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                        {view === 'approval' && (
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                <Card>
                                    <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center"><UsersIcon className="w-5 md:w-6 h-5 md:h-6 mr-2 text-brand-primary"/>Pending Registrations</h2>
                                    <div className="space-y-3 md:space-y-0 md:overflow-x-auto md:max-h-96">
                                        {/* Mobile Card Layout */}
                                        <div className="block md:hidden space-y-3">
                                            {(db?.teams || []).filter(t => t.status === 'pending').map(team => (
                                                <div key={team.id} className="p-3 bg-brand-dark rounded-lg border border-white/10">
                                                    <div className="flex flex-col space-y-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-semibold text-brand-text text-sm break-all">{team.leaderEmail}</div>
                                                            <div className="text-xs text-brand-text-dark mt-1 break-all">Txn: {team.transactionId}</div>
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => approveTeam(team.id)}
                                                                className="flex-1 bg-brand-primary hover:bg-brand-primary/80 text-brand-dark py-2 px-3 rounded text-sm font-semibold transition-colors"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => deleteTeam(team.id)}
                                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-semibold transition-colors"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Desktop Table Layout */}
                                        <table className="hidden md:table w-full">
                                            <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-4">Leader Email</th><th className="text-left py-3 px-4">Txn ID</th><th className="text-left py-3 px-4">Actions</th></tr></thead>
                                            <tbody>
                                                {(db?.teams || []).filter(t => t.status === 'pending').map(team => (
                                                    <tr key={team.id} className="border-b border-white/5 hover:bg-brand-surface/30">
                                                        <td className="py-3 px-4">{team.leaderEmail}</td>
                                                        <td className="py-3 px-4">{team.transactionId}</td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => approveTeam(team.id)} className="bg-brand-primary hover:bg-brand-primary/80 text-brand-dark px-3 py-1 rounded text-sm font-semibold transition-colors">Approve</button>
                                                                <button onClick={() => deleteTeam(team.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors">Delete</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                                <Card>
                                    <h2 className="text-xl font-bold mb-4 flex items-center"><CheckBadgeIcon className="w-6 h-6 mr-2 text-brand-primary animate-pulse"/>Approved Teams</h2>
                                    <div className="space-y-3 md:space-y-0 md:overflow-x-auto md:max-h-96">
                                        {/* Mobile Card Layout */}
                                        <div className="block md:hidden space-y-3">
                                            {(db?.teams || []).filter(t => t.status === 'approved').map(team => (
                                                <div key={team.id} className="p-4 bg-gradient-to-r from-green-600/10 to-brand-primary/10 rounded-lg border border-green-400/30 shadow-[0_0_15px_#10B981]">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-brand-text flex items-center gap-2">
                                                                <TrophyIcon className="w-5 h-5 text-brand-primary animate-bounce-gentle" />
                                                                {team.members?.[0]?.name || ''}
                                                            </div>
                                                            <div className="text-sm text-brand-text-dark">{team.leaderEmail}</div>
                                                            <div className="text-sm text-brand-text-dark">{team.members?.[0]?.college || ''}</div>
                                                        </div>
                                                        <CheckBadgeIcon className="w-6 h-6 text-green-400 flex-shrink-0 animate-pulse" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Desktop Table Layout */}
                                        <table className="hidden md:table w-full">
                                            <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-4">Leader Name</th><th className="text-left py-3 px-4">Email</th><th className="text-left py-3 px-4">College</th><th className="text-left py-3 px-4">Status</th></tr></thead>
                                            <tbody>
                                                {(db?.teams || []).filter(t => t.status === 'approved').map(team => (
                                                    <tr key={team.id} className="border-b border-white/5 hover:bg-green-600/5 transition-colors shadow-[0_0_10px_#10B981]">
                                                        <td className="py-3 px-4 flex items-center gap-2">
                                                            <TrophyIcon className="w-5 h-5 text-brand-primary animate-bounce-gentle" />
                                                            <span className="font-medium">{team.members?.[0]?.name || ''}</span>
                                                        </td>
                                                        <td className="py-3 px-4">{team.leaderEmail}</td>
                                                        <td className="py-3 px-4">{team.members?.[0]?.college || ''}</td>
                                                        <td className="py-3 px-4">
                                                            <span className="text-green-400 font-semibold flex items-center gap-1">
                                                                <CheckBadgeIcon className="w-4 h-4 animate-pulse" />
                                                                Approved
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        )}
                        {view === 'round1' && (
                            <div className="space-y-8">
                                {!db?.adminState?.round1_started && (
                                    <Card>
                                        <h3 className="text-xl font-bold mb-4 flex items-center"><PlusCircleIcon className="w-6 h-6 mr-2 text-brand-primary"/>Add New Question</h3>
                                        <div className="flex items-center space-x-4 mb-4">
                                            <label className="font-semibold">Question Type:</label>
                                            <button onClick={() => setQuestionType('mcq')} className={`px-4 py-2 rounded-lg ${questionType === 'mcq' ? 'bg-brand-primary text-brand-dark' : 'bg-brand-surface'}`}>MCQ</button>
                                            <button onClick={() => setQuestionType('coding')} className={`px-4 py-2 rounded-lg ${questionType === 'coding' ? 'bg-brand-primary text-brand-dark' : 'bg-brand-surface'}`}>Coding</button>
                                        </div>

                                        <div className="space-y-4">
                                            <textarea value={newQuestion.question} onChange={e => handleNewQuestionChange('question', e.target.value)} placeholder="Question text" className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary" rows={2}></textarea>
                                            
                                            {questionType === 'mcq' && newQuestion.options?.map((opt, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <input type="radio" name="correct-option" checked={newQuestion.correctOption === i} onChange={() => handleNewQuestionChange('correctOption', i)} className="w-4 h-4 text-brand-primary bg-gray-700 border-gray-600 focus:ring-brand-primary ring-offset-gray-800"/>
                                                    <input type="text" value={opt} onChange={e => handleNewQuestionChange('options', e.target.value, i)} placeholder={`Option ${i+1}`} className="w-full bg-brand-surface p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                                                </div>
                                            ))}

                                            {questionType === 'coding' && (
                                                <div>
                                                     <h4 className="font-semibold mb-2 mt-4">Boilerplate Code</h4>
                                                     <div className="grid grid-cols-2 gap-4">
                                                        {Object.keys(newQuestion.boilerplate).map(lang => (
                                                            <textarea key={lang} value={newQuestion.boilerplate[lang]} onChange={e => handleNewQuestionChange('boilerplate', e.target.value, undefined, lang)} placeholder={`Boilerplate for ${lang}`} className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono text-sm" rows={3}></textarea>
                                                        ))}
                                                    </div>
                                                    <h4 className="font-semibold mb-2 mt-4">Test Cases</h4>
                                                    {newQuestion.testCases?.map((tc, i) => (
                                                        <div key={i} className="flex items-center gap-2 mb-2">
                                                            <input type="text" value={tc.input} onChange={e => handleNewQuestionChange('testCases', { input: e.target.value }, i)} placeholder="Input" className="w-1/2 bg-brand-dark p-2 rounded-lg border border-white/20"/>
                                                            <input type="text" value={tc.output} onChange={e => handleNewQuestionChange('testCases', { output: e.target.value }, i)} placeholder="Expected Output" className="w-1/2 bg-brand-dark p-2 rounded-lg border border-white/20"/>
                                                            <button onClick={() => removeTestCase(i)} className="text-red-500 hover:text-red-400 p-1"><TrashIcon className="w-5 h-5"/></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={addTestCase} className="text-sm text-brand-secondary font-semibold">+ Add Test Case</button>
                                                </div>
                                            )}

                                            <button onClick={handleAddQuestion} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Add Question</button>
                                        </div>
                                    </Card>
                                )}
                                 <Card>
                                    <h3 className="text-xl font-bold mb-4 flex items-center"><ClipboardListIcon className="w-6 h-6 mr-2 text-brand-primary"/>Manage Questions ({db?.adminState?.round1_questions.length})</h3>
                                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                    {db?.adminState?.round1_questions.map((q, i) => (
                                        <div key={i} className="p-4 bg-brand-dark rounded-lg border border-white/10">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold flex-1">{i+1}. {q.question}</p>
                                                {!db?.adminState?.round1_started && <button onClick={() => handleDeleteQuestion(i)} className="text-red-500 hover:text-red-400 ml-4"><TrashIcon className="w-5 h-5"/></button>}
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${q.type === 'mcq' ? 'bg-brand-secondary/20 text-brand-secondary' : 'bg-brand-primary/20 text-brand-primary'}`}>{(q.type || '').toUpperCase()}</span>
                                            {q.type === 'mcq' && (
                                                <ul className="mt-2 text-sm list-disc list-inside pl-4">
                                                    {q.options?.map((opt, optIndex) => (
                                                        <li key={optIndex} className={`${q.correctOption === optIndex ? 'text-brand-primary font-bold' : 'text-brand-text-dark'}`}>{opt}</li>
                                                    ))}
                                                </ul>
                                            )}
                                            {q.type === 'coding' && (
                                                 <p className="text-sm text-brand-text-dark mt-2">{q.testCases?.length} test cases defined.</p>
                                            )}
                                        </div>
                                    ))}
                                    </div>
                                </Card>
                            </div>
                        )}
                        {view === 'round2' && (
                             <div className="space-y-8">
                                {!db?.adminState?.round2_started && (
                                     <Card>
                                        <h3 className="text-xl font-bold mb-4 flex items-center"><DocumentTextIcon className="w-6 h-6 mr-2 text-brand-primary"/>Problem Statement</h3>
                                        <p className="text-sm text-brand-text-dark mb-2">Directly edit the problem statement for Round 2 below.</p>
                                        <textarea 
                                            value={db?.adminState?.round2_problem}
                                            onChange={e => updateAdminState({ round2_problem: e.target.value })}
                                            rows={10}
                                            className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary whitespace-pre-wrap font-mono"
                                        />
                                    </Card>
                                )}
                                {db?.adminState?.round2_started && (
                                    <Card>
                                         <h3 className="text-xl font-bold mb-4">Current Problem Statement</h3>
                                         <p className="text-brand-text-dark whitespace-pre-wrap">{db?.adminState?.round2_problem || "No problem statement uploaded yet."}</p>
                                    </Card>
                                )}
                             </div>
                        )}
                         {view === 'results' && (
                             <div className="space-y-8">
                                <Card>
                                    <h3 className="text-xl font-bold mb-4 flex items-center"><DocumentTextIcon className="w-6 h-6 mr-2 text-brand-primary"/>Round 1 Submissions & Scores</h3>
                                    <div className="space-y-3 md:space-y-0 md:overflow-x-auto md:max-h-96">
                                        {/* Mobile Card Layout */}
                                        <div className="block md:hidden space-y-3">
                                            {(db?.teams || [])
                                                .filter(t => t.round1Submission?.endTime)
                                                .sort((a, b) => (b.round1Score || 0) - (a.round1Score || 0))
                                                .map(team => {
                                                    const percentage = round1TotalCount > 0 ? ((team.round1Score || 0) / round1TotalCount) * 100 : 0;
                                                    const qualified = percentage >= 50;
                                                    return (
                                                        <div key={team.id} className="p-4 bg-brand-dark rounded-lg border border-white/10">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex-1">
                                                                    <div className="font-semibold text-brand-text">{team.members?.[0]?.name || 'Unknown'}</div>
                                                                    <div className="text-sm text-brand-text-dark">{team.leaderEmail}</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className={`text-sm font-semibold ${qualified ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {qualified ? 'Qualified' : 'Not Qualified'}
                                                                    </div>
                                                                    <div className="text-sm text-brand-text-dark">
                                                                        {team.round1Score !== null ? `${team.round1Score}/${round1TotalCount}` : 'N/A'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                        {/* Desktop Table Layout */}
                                        <table className="hidden md:table w-full">
                                            <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-4">Team Leader</th><th className="text-left py-3 px-4">Total Score</th><th className="text-left py-3 px-4">Qualification Status</th></tr></thead>
                                            <tbody>
                                                {(db?.teams || [])
                                                    .filter(t => t.round1Submission?.endTime)
                                                    .sort((a, b) => (b.round1Score || 0) - (a.round1Score || 0))
                                                    .map(team => {
                                                        const percentage = round1TotalCount > 0 ? ((team.round1Score || 0) / round1TotalCount) * 100 : 0;
                                                        const qualified = percentage >= 50;
                                                        return (
                                                            <tr key={team.id} className="border-b border-white/5 hover:bg-brand-surface/30">
                                                                <td className="py-3 px-4">{team.members?.[0]?.name || 'Unknown'} ({team.leaderEmail})</td>
                                                                <td className="py-3 px-4">{team.round1Score !== null ? `${team.round1Score} / ${round1TotalCount}` : 'N/A'}</td>
                                                                <td className="py-3 px-4">
                                                                    <span className={`font-semibold ${qualified ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {qualified ? 'Qualified' : 'Not Qualified'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                                <Card>
                                    <h3 className="text-xl font-bold mb-4 flex items-center"><DocumentTextIcon className="w-6 h-6 mr-2 text-brand-primary"/>Round 2 Submissions & Grading</h3>
                                    <div className="space-y-3 md:space-y-0 md:overflow-x-auto md:max-h-96">
                                        {/* Mobile Card Layout */}
                                        <div className="block md:hidden space-y-3">
                                            {(db?.teams || []).filter(t => t.round2Submission?.endTime).map(team => (
                                                <div key={team.id} className="p-4 bg-brand-dark rounded-lg border border-white/10">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-brand-text mb-1">{team.members?.[0]?.name || 'Unknown'}</div>
                                                            <div className="text-sm text-brand-text-dark mb-2">
                                                                {team.round2Submission?.repoLink ? (
                                                                    <a href={team.round2Submission.repoLink} target="_blank" rel="noopener noreferrer" className="text-brand-primary underline break-all">View Repository</a>
                                                                ) : (
                                                                    <span className="text-yellow-400">Pending</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className="text-sm font-medium">Grade:</div>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={team.round2Grade ?? ''}
                                                                onChange={e => handleGradeChange(team.id, e.target.value)}
                                                                disabled={db?.adminState?.round2_finalized}
                                                                className="w-20 bg-brand-surface p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-brand-dark text-center"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Desktop Table Layout */}
                                        <table className="hidden md:table w-full">
                                            <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-4">Team Leader</th><th className="text-left py-3 px-4">Repository Link</th><th className="text-left py-3 px-4">Grade (out of 100)</th></tr></thead>
                                            <tbody>
                                                {(db?.teams || []).filter(t => t.round2Submission?.endTime).map(team => (
                                                    <tr key={team.id} className="border-b border-white/5 hover:bg-brand-surface/30">
                                                        <td className="py-3 px-4">{team.members?.[0]?.name || 'Unknown'}</td>
                                                        <td className="py-3 px-4">{team.round2Submission?.repoLink ? <a href={team.round2Submission.repoLink} target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">View Repository</a> : <span className="text-yellow-400">Pending</span>}</td>
                                                        <td className="py-3 px-4">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={team.round2Grade ?? ''}
                                                                onChange={e => handleGradeChange(team.id, e.target.value)}
                                                                disabled={db?.adminState?.round2_finalized}
                                                                className="w-24 bg-brand-surface p-1 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-brand-dark"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                                 <Card>
                                    <h3 className="text-xl font-bold mb-4 flex items-center"><TrophyIcon className="w-6 h-6 mr-2 text-brand-primary"/>Final Results</h3>
                                    <p className="text-brand-text-dark mb-4">Assign the final rankings for the top teams from the offline finale.</p>
                                    <div className="space-y-3 md:space-y-0 md:overflow-x-auto md:max-h-96">
                                        {/* Mobile Card Layout */}
                                        <div className="block md:hidden space-y-3">
                                            {(db?.teams || []).filter(t => t.status === 'qualified_round3' || (t.status || '').startsWith('winner_') || t.status === 'finalist').map(team => (
                                                <div key={team.id} className="p-4 bg-brand-dark rounded-lg border border-white/10">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="font-semibold text-brand-text">{team.members?.[0]?.name || 'Unknown'}</div>
                                                            <div className="text-sm text-brand-text-dark">Current: {team.round3Result || 'Finalist'}</div>
                                                        </div>
                                                        <select
                                                            value={team.round3Result || 'Finalist'}
                                                            onChange={e => handleRound3Result(team.id, e.target.value)}
                                                            className="bg-brand-surface p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-brand-primary text-sm"
                                                        >
                                                            <option value="Finalist">Finalist</option>
                                                            <option value="1st">1st Place</option>
                                                            <option value="2nd">2nd Place</option>
                                                            <option value="3rd">3rd Place</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Desktop Table Layout */}
                                        <table className="hidden md:table w-full">
                                            <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-4">Team Leader</th><th className="text-left py-3 px-4">Result</th></tr></thead>
                                            <tbody>
                                                {(db?.teams || []).filter(t => t.status === 'qualified_round3' || (t.status || '').startsWith('winner_') || t.status === 'finalist').map(team => (
                                                    <tr key={team.id} className="border-b border-white/5 hover:bg-brand-surface/30">
                                                        <td className="py-3 px-4">{team.members?.[0]?.name || 'Unknown'}</td>
                                                        <td className="py-3 px-4">
                                                            <select
                                                                value={team.round3Result || 'Finalist'}
                                                                onChange={e => handleRound3Result(team.id, e.target.value)}
                                                                className="bg-brand-surface p-2 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                                            >
                                                                <option value="Finalist">Finalist</option>
                                                                <option value="1st">1st Place</option>
                                                                <option value="2nd">2nd Place</option>
                                                                <option value="3rd">3rd Place</option>
                                                            </select>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                    <Modal isOpen={adminConfirm.isOpen} onClose={() => setAdminConfirm({ ...adminConfirm, isOpen: false })}>
                        <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
                        <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Confirm Action</h3>
                        <p className="text-brand-text-dark">Are you sure you want to proceed with this action?</p>
                        <div className="mt-6 flex justify-center space-x-4">
                            <button onClick={() => setAdminConfirm({ ...adminConfirm, isOpen: false })} className="bg-brand-surface hover:bg-brand-surface/80 text-white font-bold py-2 px-6 rounded-lg">Cancel</button>
                            <button onClick={async () => {
                                setAdminConfirm({ ...adminConfirm, isOpen: false });
                                if (adminConfirm.action === 'deleteQuestion') {
                                    const idx = adminConfirm.payload as number;
                                    const updatedQuestions = db?.adminState?.round1_questions.filter((_, i) => i !== idx);
                                    await updateAdminState({ round1_questions: updatedQuestions || [] });
                                    setAdminModal({ isOpen: true, type: 'success', title: 'Deleted', message: 'Question deleted successfully.' });
                                }
                            }} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Confirm</button>
                        </div>
                    </Modal>

                    <Modal isOpen={adminModal.isOpen} onClose={() => setAdminModal({ ...adminModal, isOpen: false })}>
                        {adminModal.type === 'success' && (
                            <>
                                <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500" />
                                <h3 className="text-xl font-bold text-green-400 mt-4 mb-2">{adminModal.title || 'Success'}</h3>
                                <p className="text-brand-text-dark">{adminModal.message}</p>
                                <div className="mt-6 flex justify-center">
                                    <button onClick={() => setAdminModal({ ...adminModal, isOpen: false })} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">OK</button>
                                </div>
                            </>
                        )}
                        {adminModal.type === 'error' && (
                            <>
                                <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-500" />
                                <h3 className="text-xl font-bold text-red-400 mt-4 mb-2">{adminModal.title || 'Error'}</h3>
                                <p className="text-brand-text-dark">{adminModal.message}</p>
                                <div className="mt-6 flex justify-center">
                                    <button onClick={() => setAdminModal({ ...adminModal, isOpen: false })} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Close</button>
                                </div>
                            </>
                        )}
                    </Modal>

                    <Modal isOpen={showCloseRegModal} onClose={() => setShowCloseRegModal(false)}>
                        <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
                        <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Confirm Action</h3>
                        <p className="text-brand-text-dark">Are you sure you want to close registrations? This action cannot be undone.</p>
                        <div className="mt-6 flex justify-center space-x-4">
                            <button 
                                onClick={() => setShowCloseRegModal(false)} 
                                className="bg-brand-surface hover:bg-brand-surface/80 text-white font-bold py-2 px-6 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    updateAdminState({ registrations_open: false });
                                    setShowCloseRegModal(false);
                                }} 
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg"
                            >
                                Confirm & Close
                            </button>
                        </div>
                    </Modal>
                </main>
            </div>
        </PageTransition>
    );
};


// --- Test Pages ---

const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const MobileWarning = () => (
    <div className="fixed inset-0 bg-brand-dark z-[100] flex items-center justify-center p-4">
        <Card className="text-center">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
            <h2 className="text-2xl font-bold mt-4 text-yellow-400">Mobile Device Detected</h2>
            <p className="text-brand-text-dark mt-2">This test must be taken on a laptop or desktop computer to ensure a fair and stable environment.</p>
            <p className="text-brand-text-dark mt-1">Please switch to a supported device to proceed.</p>
            <Link to="/dashboard" className="mt-6 inline-block bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Back to Dashboard</Link>
        </Card>
    </div>
);

const Round1Instructions = ({ onStart }: { onStart: () => void }) => (
    <div className="fixed inset-0 bg-brand-dark z-[100] flex items-center justify-center p-4">
        <Card className="max-w-2xl text-center">
            <h1 className="text-3xl font-bold text-brand-primary mb-4">Round 1 - Test Instructions</h1>
            <ul className="text-left space-y-3 text-brand-text-dark mb-8">
                <li className="flex items-start"><ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-1 text-yellow-400 flex-shrink-0"/> This test is designed for desktops/laptops only. Attempting it on a mobile device may lead to disqualification.</li>
                <li className="flex items-start"><ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-1 text-yellow-400 flex-shrink-0"/> The test must be taken in fullscreen mode to ensure fairness.</li>
                <li className="flex items-start"><ClockIcon className="w-5 h-5 mr-3 mt-1 text-brand-secondary flex-shrink-0"/> You will have 60 minutes to complete all questions. The timer starts when you begin.</li>
                <li className="flex items-start"><ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-1 text-yellow-400 flex-shrink-0"/> Do not switch tabs or exit fullscreen. Doing so will trigger a warning, and repeated violations will lead to disqualification.</li>
                <li className="flex items-start"><CheckCircleListIcon className="w-5 h-5 mr-3 mt-1 text-green-400 flex-shrink-0"/> For coding questions, you must run your code and pass all test cases before your submission is accepted.</li>
            </ul>
            <button onClick={onStart} className="bg-brand-primary text-brand-dark font-bold py-3 px-8 rounded-lg animate-glow-primary">
                I Understand, Start the Test
            </button>
        </Card>
    </div>
);

const Round1TestPage = () => {
    const { user, db, updateTeam } = useAuth();
    const navigate = useNavigate();
    const team = db?.teams?.find(t => t.id === user?.teamId);
    const questions = db?.adminState?.round1_questions || [];
    
    const [isMobile, setIsMobile] = useState(false);
    const [testStarted, setTestStarted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Round1Answer[]>(() => new Array(questions.length).fill(null));
    const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [showFinishWarning, setShowFinishWarning] = useState(false);
    const [startErrorModal, setStartErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
    const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set([0]));


    // Code Editor specific state
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState<Array<{ 
        status: 'Passed' | 'Failed', 
        message: string,
        input: string,
        expected: string,
        output: string,
    }> | null>(null);
    const [isEditorExpanded, setIsEditorExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'results' | 'console'>('results');
    const [consoleOutput, setConsoleOutput] = useState('');

    useEffect(() => {
        if (isMobileDevice()) setIsMobile(true);
    }, []);

    if (!questions || questions.length === 0) {
        return (
            <div className="fixed inset-0 bg-brand-dark z-[100] flex items-center justify-center p-4">
                <Card className="text-center">
                    <h2 className="text-xl font-bold">No Questions Available</h2>
                    <p className="text-brand-text-dark mt-2">The test has not been configured by the admin yet. Please try again later.</p>
                    <button onClick={() => {
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                        }
                        navigate('/dashboard');
                    }} className="mt-6 bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Back to Dashboard</button>
                </Card>
            </div>
        );
    }

    const finishTest = useCallback(() => {
        const submission = team?.round1Submission || { startTime: Date.now(), endTime: null, answers: [] };
        updateTeam(user.teamId, { 
            round1Submission: { ...submission, endTime: Date.now(), answers }
        });
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        navigate('/dashboard');
    }, [team, user.teamId, answers, updateTeam, navigate]);

    const disqualifyAndExit = useCallback(() => {
        updateTeam(user.teamId, { status: 'disqualified_round1', disqualificationReason: 'cheating' });
        finishTest();
    }, [user.teamId, updateTeam, finishTest]);

    // Auto-submit, fullscreen and anti-cheating logic
    useEffect(() => {
        if (!testStarted) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    finishTest();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        const handleVisibilityChange = () => { if (document.hidden) setShowWarningModal(true); };
        const handleFullscreenChange = () => { if (!document.fullscreenElement) setShowWarningModal(true); };
        
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [testStarted, finishTest]);
    
    useEffect(() => {
        if (testStarted) {
            setViewedIndices(prev => new Set(prev).add(currentIndex));
        }
    }, [currentIndex, testStarted]);

    // Update editor state when changing questions or language
    useEffect(() => {
        const currentAnswer = answers[currentIndex];
        const currentQuestion = questions[currentIndex];
        if (currentQuestion?.type === 'coding') {
            if (typeof currentAnswer === 'object' && currentAnswer !== null && currentAnswer.language === language) {
                setCode(currentAnswer.code);
            } else {
                setCode(currentQuestion.boilerplate?.[language] || `// Boilerplate for ${language} not available.`);
            }
        }
        setRunResult(null);
        setConsoleOutput('');
        setActiveTab('results');
    }, [currentIndex, language, questions, answers]);

    const handleAnswer = (answer: Round1Answer) => {
        const newAnswers = [...answers];
        newAnswers[currentIndex] = answer;
        setAnswers(newAnswers);
    };
    
    const handleStartTest = () => {
        document.documentElement.requestFullscreen().catch(err => {
            setStartErrorModal({ isOpen: true, message: `Error attempting to enable full-screen mode: ${err.message} (${err.name})` });
        });
        updateTeam(user.teamId, {
             round1Submission: { startTime: Date.now(), endTime: null, answers }
        });
        setTestStarted(true);
    };

    const simulateCompilation = (code: string, language: string) => {
        // Basic syntax checks for non-JS languages to simulate compilation
        switch (language) {
            case 'python':
                if (!/def\s+sum\s*\(\s*a\s*,\s*b\s*\)\s*:/.test(code)) {
                    return { success: false, error: "Syntax Error: Missing function definition 'def sum(a, b):'" };
                }
                break;
            case 'java':
                if (!/class\s+Solution/.test(code)) {
                    return { success: false, error: "Compilation Error: Missing 'class Solution' wrapper." };
                }
                if (!/public\s+static\s+int\s+sum\s*\(\s*int\s+a\s*,\s*int\s+b\s*\)/.test(code)) {
                    return { success: false, error: "Compilation Error: Missing method signature 'public static int sum(int a, int b)'." };
                }
                break;
            case 'cpp':
            case 'c':
                if (!/int\s+sum\s*\(\s*int\s+a\s*,\s*int\s+b\s*\)/.test(code)) {
                     return { success: false, error: "Compilation Error: Missing function signature 'int sum(int a, int b)'." };
                }
                break;
            case 'javascript':
                try {
                    new Function(code); // Use new Function for a basic syntax check
                } catch (e: any) {
                    return { success: false, error: `Syntax Error: ${e.message}` };
                }
                break;
            default:
                break;
        }
        return { success: true, error: null };
    };

    const simulateExecution = (code: string, language: string, testCase: TestCase) => {
        // This function simulates code execution. For JS, it's straightforward. For other languages (C, C++, Java),
        // it performs a lightweight "transpilation" of the function body to JavaScript to execute the logic.
        // This allows it to handle variables and multi-line logic, providing a realistic experience.
        try {
            const { input, output: expectedOutput } = testCase;
            const inputValues: { [key: string]: number } = input.split(',').reduce((acc, part) => {
                const [key, value] = part.split('=').map(s => s.trim());
                if (key && value !== undefined) {
                  acc[key] = parseInt(value, 10);
                }
                return acc;
            }, {} as { [key: string]: number });
            
            const params = Object.keys(inputValues);
            const values = Object.values(inputValues);

            let actualOutput;

            if (language === 'javascript') {
                const userFunc = new Function(...params, `${code}\nreturn sum(${params.join(',')});`);
                actualOutput = userFunc(...values);
            } else {
                // More robust simulation for other languages:
                // 1. Extract the function body between the curly braces.
                // 2. Perform a mini-transpilation to convert simple C-style/Java syntax to JS.
                // 3. Execute the transpiled code.
                const bodyMatch = code.match(/\{([\s\S]*)\}/);
                if (!bodyMatch || !bodyMatch[1]) {
                    throw new Error("Could not find a valid function body (e.g., {...}).");
                }
                
                let functionBody = bodyMatch[1];

                // Simple "transpiler" to handle variable declarations.
                // Replaces `int varName`, `double varName` etc. with `let varName`.
                functionBody = functionBody.replace(/\b(int|double|float|String|long)\s+/g, 'let ');

                const evaluator = new Function(...params, functionBody);
                actualOutput = evaluator(...values);
            }

            const passed = String(actualOutput) === String(expectedOutput);
            return { output: String(actualOutput), passed };

        } catch (e: any) {
            return { output: `Runtime Error: ${e.message}`, passed: false };
        }
    };

    const runCode = async () => {
        setIsRunning(true);
        setRunResult(null);
        setActiveTab('console');
        setConsoleOutput('Compiling...\n');

        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate compilation time

        const currentQuestion = questions[currentIndex];
        if (!currentQuestion || currentQuestion.type !== 'coding' || !currentQuestion.testCases) {
            setConsoleOutput('Error: Could not find test cases for this question.');
            setIsRunning(false);
            return;
        }

        const compilationResult = simulateCompilation(code, language);

        if (!compilationResult.success) {
            setConsoleOutput(prev => prev + `\n❌ Compilation Failed: \n${compilationResult.error}`);
            setIsRunning(false);
            return;
        }
        
        setConsoleOutput(prev => prev + '✅ Compilation successful.\n\nRunning test cases...\n');
        
        const resultsSummary: Array<{ 
            status: 'Passed' | 'Failed', 
            message: string, 
            input: string, 
            expected: string, 
            output: string 
        }> = [];
        
        for (let i = 0; i < currentQuestion.testCases.length; i++) {
            const tc = currentQuestion.testCases[i];
            await new Promise(resolve => setTimeout(resolve, 200)); // Simulate execution time for each case
            
            const executionResult = simulateExecution(code, language, tc);

            resultsSummary.push({
                status: executionResult.passed ? 'Passed' : 'Failed',
                message: `Test Case ${i + 1}`,
                input: tc.input,
                expected: tc.output,
                output: executionResult.output,
            });

            const detailedOutput = `
--------------------
> Test Case ${i + 1}:
  Input:           ${tc.input}
  Expected Output: ${tc.output}
  Your Output:     ${executionResult.output}
  Result:          ${executionResult.passed ? '✅ Passed' : '❌ Failed'}
`;
            setConsoleOutput(prev => prev + detailedOutput);
        }
        
        setActiveTab('results');
        setRunResult(resultsSummary);
        setIsRunning(false);
    };


    const submitCode = () => {
        const allPassed = runResult && runResult.every(r => r.status === 'Passed');
        if (allPassed) {
            handleAnswer({ code, language, passed: true });
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(currentIndex + 1);
            }
        }
    };
    
    if (!team || team.status !== 'approved' || !db?.adminState?.round1_started) return <Navigate to="/dashboard" />;
    if (!testStarted) return <Round1Instructions onStart={handleStartTest} />;

    const currentQuestion = questions[currentIndex];
    const allTestsPassed = runResult?.every(r => r.status === 'Passed');

    return (
        <div className="fixed inset-0 bg-brand-dark z-[100] flex flex-col">
             <div className="flex justify-between items-center p-4 border-b border-white/10 glassmorphism flex-shrink-0">
                <h1 className="text-xl md:text-2xl font-bold text-brand-primary">Round 1 Test</h1>
                <div className="flex items-center space-x-2 md:space-x-6">
                    <div className="flex items-center text-lg md:text-xl font-mono bg-brand-surface px-3 py-2 rounded-lg">
                        <ClockIcon className="w-5 h-5 mr-2" /> {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
                    </div>
                    <button onClick={() => setShowFinishWarning(true)} className="bg-brand-secondary text-brand-dark font-bold py-2 px-4 md:px-6 rounded-lg text-sm md:text-base">Finish Test</button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <nav className="w-24 sm:w-48 p-2 sm:p-4 overflow-y-auto glassmorphism rounded-bl-xl flex-shrink-0">
                    <h2 className="font-bold mb-2 px-2 hidden sm:block">Questions</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {questions.map((q, i) => {
                         const answer = answers[i];
                         let statusClass = 'bg-brand-dark hover:bg-brand-dark/80';
                          if (currentIndex === i) {
                            statusClass = 'bg-brand-primary text-brand-dark ring-2 ring-brand-secondary';
                        } else if (answer !== null) {
                            statusClass = 'bg-brand-accent/30 text-brand-accent'; // Attempted
                        } else if (viewedIndices.has(i)) {
                            statusClass = 'bg-brand-surface'; // Viewed
                        }
                        return <button key={i} onClick={() => setCurrentIndex(i)} className={`aspect-square rounded-lg flex items-center justify-center font-bold transition-colors ${statusClass}`}>{i + 1}</button>
                    })}
                    </div>
                </nav>
                <main className="flex-1 flex flex-col p-4 overflow-hidden">
                    {currentQuestion.type === 'coding' ? (
                        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
                            <div className="w-full lg:w-1/2 flex flex-col glassmorphism rounded-lg p-6 overflow-y-auto">
                                <h3 className="text-xl font-semibold mb-2">Question {currentIndex + 1} of {questions.length}</h3>
                                <p className="text-brand-text-dark mb-6 whitespace-pre-wrap flex-grow">{currentQuestion.question}</p>
                            </div>
                            <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-hidden">
                                <div className={`flex flex-col glassmorphism rounded-lg p-4 transition-all duration-300 ${isEditorExpanded ? 'flex-[3_3_0%]' : 'flex-1'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-brand-surface p-2 rounded-lg border border-white/20">
                                            <option value="c">C</option><option value="cpp">C++</option><option value="java">Java</option><option value="python">Python</option><option value="javascript">JavaScript</option>
                                        </select>
                                        <button onClick={() => setIsEditorExpanded(!isEditorExpanded)} title="Toggle Editor Size" className="p-2 hover:bg-brand-surface rounded-lg">
                                            {isEditorExpanded ? <ArrowsPointingInIcon/> : <ArrowsPointingOutIcon/>}
                                        </button>
                                    </div>
                                    <CodeEditor code={code} setCode={setCode} language={language}/>
                                </div>
                                <div className="flex flex-col glassmorphism rounded-lg p-4 flex-1 overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-1">
                                            <button onClick={() => setActiveTab('results')} className={`font-semibold py-2 px-4 rounded-lg ${activeTab === 'results' ? 'text-brand-primary' : 'text-brand-text-dark'}`}>Results</button>
                                            <button onClick={() => setActiveTab('console')} className={`font-semibold py-2 px-4 rounded-lg ${activeTab === 'console' ? 'text-brand-primary' : 'text-brand-text-dark'}`}>Console</button>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button onClick={runCode} disabled={isRunning} className="bg-brand-secondary/80 hover:bg-brand-secondary text-brand-dark font-semibold py-2 px-4 rounded-lg disabled:bg-gray-600">{isRunning ? 'Running...' : 'Run Code'}</button>
                                            <button onClick={submitCode} disabled={!allTestsPassed} className="bg-brand-primary/80 hover:bg-brand-primary text-brand-dark font-semibold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">Submit</button>
                                        </div>
                                    </div>
                                    {activeTab === 'results' && (
                                        <div className="space-y-2 overflow-y-auto">
                                            {isRunning ? <p className="text-brand-text-dark">Running test cases...</p> : runResult ? runResult.map((res, i) => (
                                                <div key={i} className={`p-3 rounded-lg text-sm ${res.status === 'Passed' ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
                                                    <div className={`font-semibold flex items-center mb-2 ${res.status === 'Passed' ? 'text-green-300' : 'text-red-400'}`}>
                                                        {res.status === 'Passed' ? <CheckCircleIcon className="w-5 h-5 mr-2"/> : <ExclamationTriangleIcon className="w-5 h-5 mr-2"/>}
                                                        {res.message}: {res.status}
                                                    </div>
                                                    <div className="font-mono text-xs space-y-1 pl-7 text-brand-text-dark">
                                                        <p><span className="font-semibold text-brand-text-dark/80">Input: &nbsp;&nbsp;&nbsp;</span> {res.input}</p>
                                                        <p><span className="font-semibold text-brand-text-dark/80">Expected: </span> {res.expected}</p>
                                                        <p><span className="font-semibold text-brand-text-dark/80">Output: &nbsp;&nbsp; </span> {res.output}</p>
                                                    </div>
                                                </div>
                                            )) : <p className="text-brand-text-dark">Run code to see test case results.</p>}
                                        </div>
                                    )}
                                     {activeTab === 'console' && (
                                        <pre className="w-full h-full bg-brand-dark p-2 rounded-md text-sm text-brand-text-dark font-mono overflow-auto whitespace-pre-wrap">{consoleOutput || 'Console output will appear here...'}</pre>
                                     )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-3xl mx-auto flex flex-col glassmorphism rounded-lg p-6 overflow-y-auto">
                            <h3 className="text-xl font-semibold mb-2">Question {currentIndex + 1} of {questions.length}</h3>
                            <p className="text-brand-text-dark mb-6 whitespace-pre-wrap">{currentQuestion.question}</p>
                             <div className="space-y-4">
                                {currentQuestion.options?.map((opt, i) => (
                                    <label key={i} className={`flex items-center p-4 rounded-lg cursor-pointer transition-all border-2 ${answers[currentIndex] === i ? 'bg-brand-primary/20 border-brand-primary' : 'bg-brand-surface border-transparent hover:border-brand-secondary/50'}`}>
                                        <input type="radio" name="option" checked={answers[currentIndex] === i} onChange={() => handleAnswer(i)} className="w-5 h-5 text-brand-primary bg-brand-dark border-gray-500 focus:ring-brand-primary"/>
                                        <span className="ml-4">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-4 flex-shrink-0">
                        <button onClick={() => setCurrentIndex(i => i - 1)} disabled={currentIndex === 0} className="bg-brand-surface font-semibold py-2 px-6 rounded-lg disabled:opacity-50">Previous</button>
                        <button onClick={() => setCurrentIndex(i => i + 1)} disabled={currentIndex === questions.length - 1} className="bg-brand-surface font-semibold py-2 px-6 rounded-lg disabled:opacity-50">Next</button>
                    </div>
                </main>
            </div>
             <Modal isOpen={startErrorModal.isOpen} onClose={() => setStartErrorModal({ ...startErrorModal, isOpen: false })}>
                <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-500"/>
                <h3 className="text-xl font-bold text-red-400 mt-4 mb-2">Error</h3>
                <p className="text-brand-text-dark">{startErrorModal.message}</p>
                <div className="mt-6 flex justify-center">
                    <button onClick={() => setStartErrorModal({ ...startErrorModal, isOpen: false })} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Close</button>
                </div>
            </Modal>

             <Modal isOpen={showWarningModal} onClose={() => {}}>
                <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
                <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Warning!</h3>
                <p className="text-brand-text-dark">You have left the test environment. This is against the rules. Further violations will result in disqualification.</p>
                <div className="mt-6 flex justify-center space-x-4">
                    <button onClick={() => { document.documentElement.requestFullscreen(); setShowWarningModal(false); }} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Return to Test</button>
                    <button onClick={disqualifyAndExit} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg">Exit & Disqualify</button>
                </div>
            </Modal>
             <Modal isOpen={showFinishWarning} onClose={() => setShowFinishWarning(false)}>
               <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
               <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Finish Test?</h3>
               <p className="text-brand-text-dark">Are you sure you want to submit your test? You cannot make any more changes.</p>
               <div className="mt-6 flex justify-center space-x-4">
                   <button onClick={() => setShowFinishWarning(false)} className="bg-brand-surface hover:bg-brand-surface/80 text-white font-bold py-2 px-6 rounded-lg">Cancel</button>
                   <button onClick={finishTest} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Confirm & Submit</button>
               </div>
           </Modal>

           <Modal isOpen={isMobile} onClose={() => {}}>
               <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500"/>
               <h2 className="text-2xl font-bold mt-4 text-yellow-400">Mobile Device Detected</h2>
               <p className="text-brand-text-dark mt-2">This test must be taken on a laptop or desktop computer to ensure a fair and stable environment.</p>
               <p className="text-brand-text-dark mt-1">Please switch to a supported device to proceed.</p>
               <div className="mt-6 flex justify-center">
                   <Link to="/dashboard" className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Back to Dashboard</Link>
               </div>
           </Modal>
       </div>
   );
};


const Round2TestPage = () => {
    const { user, db, updateTeam } = useAuth();
    const navigate = useNavigate();
    const team = db?.teams?.find(t => t.id === user?.teamId);

    const [repoLink, setRepoLink] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [submissionModal, setSubmissionModal] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'invalid-link'; message: string }>({ isOpen: false, type: 'success', message: '' });

    useEffect(() => {
        if (isMobileDevice()) setIsMobile(true);
    }, []);

    const isValidGitHubUrl = (url: string) => {
        const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/;
        return githubRegex.test(url);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoLink.trim()) {
            setSubmissionModal({ isOpen: true, type: 'invalid-link', message: 'Please enter a GitHub repository link.' });
            return;
        }
        if (!isValidGitHubUrl(repoLink)) {
            setSubmissionModal({ isOpen: true, type: 'invalid-link', message: 'Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo).' });
            return;
        }
        setIsSubmitting(true);

        try {
            console.log('[Round2] Submitting GitHub repo link:', repoLink);

            // Persist repo link to Firestore
            await updateTeam(user.teamId, {
                round2Submission: {
                    startTime: team?.round2Submission?.startTime || Date.now(),
                    endTime: Date.now(),
                    repoLink: repoLink.trim()
                }
            });

            console.log('[Round2] Submission complete!');
            setSubmissionModal({ isOpen: true, type: 'success', message: 'GitHub repository link submitted successfully!' });
            setRepoLink(''); // Clear input after successful submission
        } catch (error: any) {
            const errorMsg = error?.message || 'Unknown error';
            console.error('[Round2] Submission error:', errorMsg, error);
            setSubmissionModal({ isOpen: true, type: 'error', message: `Error submitting link: ${errorMsg}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isMobile) return <MobileWarning />;

     if (!team || team.status !== 'qualified_round2' || !db?.adminState?.round2_started) {
        return <Navigate to="/dashboard" />;
    }

    return (
        <PageTransition>
            <div className="min-h-screen pt-24 md:pt-28 pb-10">
                <Card className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold mb-4">Round 2: Problem Statement</h2>
                    <div className="p-4 bg-brand-dark rounded-lg border border-white/10 mb-6">
                        <p className="text-brand-text-dark whitespace-pre-wrap">{db?.adminState?.round2_problem}</p>
                    </div>

                    <h3 className="text-2xl font-bold mb-4">Submit Your Project</h3>
                    <p className="text-brand-text-dark mb-4">Please provide the GitHub repository link for your project.</p>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="url"
                            placeholder="https://github.com/username/repository"
                            value={repoLink}
                            onChange={e => setRepoLink(e.target.value)}
                            required
                            className="w-full bg-brand-surface p-3 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                        <button type="submit" disabled={isSubmitting || !repoLink.trim()} className="mt-6 bg-brand-primary text-brand-dark font-bold py-3 px-8 rounded-lg transition-opacity duration-300 animate-glow-primary hover:opacity-90 disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Submitting...' : 'Submit Repository Link'}
                        </button>
                    </form>
                </Card>

                <Modal isOpen={submissionModal.isOpen} onClose={() => {
                    setSubmissionModal({ ...submissionModal, isOpen: false });
                    if (submissionModal.type === 'success') {
                        navigate('/dashboard');
                    }
                }}>
                    {submissionModal.type === 'success' && (
                        <>
                            <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500" />
                            <h3 className="text-xl font-bold text-green-400 mt-4 mb-2">Success!</h3>
                            <p className="text-brand-text-dark mb-6">{submissionModal.message}</p>
                            <button onClick={() => {
                                setSubmissionModal({ ...submissionModal, isOpen: false });
                                navigate('/dashboard');
                            }} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Back to Dashboard</button>
                        </>
                    )}
                    {submissionModal.type === 'error' && (
                        <>
                            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-500" />
                            <h3 className="text-xl font-bold text-red-400 mt-4 mb-2">Error</h3>
                            <p className="text-brand-text-dark mb-6">{submissionModal.message}</p>
                            <button onClick={() => setSubmissionModal({ ...submissionModal, isOpen: false })} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Close</button>
                        </>
                    )}
                    {submissionModal.type === 'invalid-link' && (
                        <>
                            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500" />
                            <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Invalid Link</h3>
                            <p className="text-brand-text-dark mb-6">{submissionModal.message}</p>
                            <button onClick={() => setSubmissionModal({ ...submissionModal, isOpen: false })} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Close</button>
                        </>
                    )}
                </Modal>
            </div>
        </PageTransition>
    );
};

const ProtectedRoute = ({ children, role }: { children: React.ReactElement; role: 'admin' | 'team' }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    if (!user) return <Navigate to="/login" />;
    return user.role === role ? children : <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} />;
};


const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
    </div>
);

const App = () => {
    console.log('🚀 App component rendering');
    return (
        <AuthProvider>
            <HashRouter>
                <ScrollToTop />
                <Header />
                <main className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/details" element={<DetailsPage />} />
                            <Route path="/faq" element={<FAQPage />} />
                            <Route path="/contact" element={<ContactPage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/dashboard" element={<ProtectedRoute role="team" children={<DashboardPage />} />} />
                            <Route path="/admin" element={<ProtectedRoute role="admin" children={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />} />
                            <Route path="/test/round1" element={<ProtectedRoute role="team" children={<Round1TestPage />}/>} />
                            <Route path="/test/round2" element={<ProtectedRoute role="team" children={<Round2TestPage />}/>} />
                        </Routes>
                    </Suspense>
                </main>
                <Footer />
            </HashRouter>
        </AuthProvider>
    );
};

export default App;