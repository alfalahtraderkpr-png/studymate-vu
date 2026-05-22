'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore, type VideoLectureInfo, type VULMSQuizInfo, type VULMSAssignmentInfo } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen,
  MessageSquare,
  Brain,
  LogOut,
  ArrowLeft,
  ChevronRight,
  Loader2,
  GraduationCap,
  Eye,
  EyeOff,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  RotateCcw,
  Send,
  Sparkles,
  Play,
  Video,
  Bell,
  BellRing,
  ClipboardList,
  CalendarClock,
  Clock,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  X,
  Download,
  Youtube,
  ListChecks,
  BarChart3,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

// ─── Page Transition Wrapper ──────────────────────────────────────────────────
function PageTransition({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Login View ───────────────────────────────────────────────────────────────
function LoginView() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const login = useAppStore((s) => s.login);
  const loginDemo = useAppStore((s) => s.loginDemo);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !password.trim()) {
      toast({ title: 'Error', description: 'Please enter both Student ID and Password', variant: 'destructive' });
      return;
    }
    setIsLoggingIn(true);
    try {
      await login(studentId.trim(), password);
      toast({ title: 'Success', description: 'Logged in successfully!' });
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Could not connect to VULMS',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemo = async () => {
    setIsLoggingIn(true);
    try {
      await loginDemo();
      toast({ title: 'Demo Mode', description: 'Welcome! Explore with sample data.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/20 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-600 text-white mb-4 shadow-lg shadow-emerald-600/30"
          >
            <GraduationCap className="w-10 h-10" />
          </motion.div>
          <h1 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">StudyMate VU</h1>
          <p className="text-muted-foreground mt-2">AI-Powered Study Assistant for VU Students</p>
        </div>

        <Card className="shadow-xl border-emerald-200 dark:border-emerald-800/50">
          <CardHeader>
            <CardTitle className="text-xl">Login to VULMS</CardTitle>
            <CardDescription>Enter your Virtual University LMS credentials to access your subjects</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studentId">Student ID (VU ID)</Label>
                <Input
                  id="studentId"
                  placeholder="e.g. BC123456789"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={isLoggingIn}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your VULMS password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoggingIn}
                    className="h-11 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-9 w-9"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in to VULMS...
                  </>
                ) : (
                  'Login to VULMS'
                )}
              </Button>
            </form>

            <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">How it works:</p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>1. Enter your VULMS Student ID and Password</li>
                <li>2. AI logs in (read-only) and loads your subjects</li>
                <li>3. No activities performed on LMS - VU can&apos;t detect</li>
                <li>4. Takes 15-30 seconds for first login</li>
              </ul>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or try Demo</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={handleDemo}
              disabled={isLoggingIn}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Demo Mode (No Login Required)
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Read-only access. We never modify your VULMS data.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Loading View ─────────────────────────────────────────────────────────────
function LoadingView() {
  const loadingMessage = useAppStore((s) => s.loadingMessage);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/20 p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center space-y-6"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
        >
          <GraduationCap className="w-10 h-10" />
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {loadingMessage || 'Loading...'}
          </h2>
          <Progress className="w-64 mx-auto h-2" />
          <p className="text-sm text-muted-foreground">
            Please wait while we connect to VULMS
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dashboard View (Enhanced) ────────────────────────────────────────────────
function DashboardView() {
  const subjects = useAppStore((s) => s.subjects);
  const selectSubject = useAppStore((s) => s.selectSubject);
  const setView = useAppStore((s) => s.setView);
  const studentId = useAppStore((s) => s.studentId);
  const logout = useAppStore((s) => s.logout);
  const notifications = useAppStore((s) => s.notifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Calculate summary stats
  const totalQuizzes = subjects.reduce((acc, s) => acc + s.quizzes.length, 0);
  const pendingQuizzes = subjects.reduce((acc, s) => acc + s.quizzes.filter(q => q.status === 'not_started').length, 0);
  const completedQuizzes = subjects.reduce((acc, s) => acc + s.quizzes.filter(q => q.status === 'completed').length, 0);
  const totalAssignments = subjects.reduce((acc, s) => acc + s.assignments.length, 0);
  const pendingAssignments = subjects.reduce((acc, s) => acc + s.assignments.filter(a => a.status === 'not_submitted').length, 0);
  const overdueAssignments = subjects.reduce((acc, s) => acc + s.assignments.filter(a => a.status === 'overdue').length, 0);
  const totalVideos = subjects.reduce((acc, s) => acc + s.videos.length, 0);
  const totalHandouts = subjects.reduce((acc, s) => acc + s.handouts.length, 0);

  const urgentNotifications = notifications.filter(n => n.daysLeft <= 2 && !n.read);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">StudyMate VU</h1>
              <p className="text-xs text-muted-foreground">{studentId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('notifications')}
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
              {subjects.length} Subjects
            </Badge>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Urgent Notifications Banner */}
        {urgentNotifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-700 dark:text-red-400 text-sm">Urgent Deadlines!</span>
                </div>
                <div className="space-y-1">
                  {urgentNotifications.slice(0, 3).map((n) => (
                    <p key={n.id} className="text-xs text-red-600 dark:text-red-400">
                      {n.subjectCode} - {n.title}: {n.daysLeft === 0 ? 'Aaj last day hai!' : `${n.daysLeft} din baaki`}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-blue-200 dark:border-blue-800/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Quizzes</span>
                </div>
                <p className="text-xl font-bold">{completedQuizzes}<span className="text-sm font-normal text-muted-foreground">/{totalQuizzes}</span></p>
                <p className="text-xs text-blue-600">{pendingQuizzes} pending</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 dark:border-orange-800/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-muted-foreground">Assignments</span>
                </div>
                <p className="text-xl font-bold">{totalAssignments - pendingAssignments}<span className="text-sm font-normal text-muted-foreground">/{totalAssignments}</span></p>
                <p className="text-xs text-orange-600">{pendingAssignments} pending{overdueAssignments > 0 ? `, ${overdueAssignments} overdue` : ''}</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 dark:border-purple-800/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Video className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">Videos</span>
                </div>
                <p className="text-xl font-bold">{totalVideos}</p>
                <p className="text-xs text-purple-600">Lectures available</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 dark:border-emerald-800/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-muted-foreground">Handouts</span>
                </div>
                <p className="text-xl font-bold">{totalHandouts}</p>
                <p className="text-xs text-emerald-600">Files available</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1.5 border-emerald-300 dark:border-emerald-700"
              onClick={() => setView('tracker')}
            >
              <ListChecks className="h-5 w-5 text-emerald-600" />
              <span className="text-xs">Quiz Tracker</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1.5 border-orange-300 dark:border-orange-700"
              onClick={() => setView('tracker')}
            >
              <ClipboardList className="h-5 w-5 text-orange-600" />
              <span className="text-xs">Assignments</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1.5 border-purple-300 dark:border-purple-700"
              onClick={() => setView('notifications')}
            >
              <BellRing className="h-5 w-5 text-purple-600" />
              <span className="text-xs">Reminders</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1.5 border-blue-300 dark:border-blue-700"
              onClick={() => setView('tracker')}
            >
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span className="text-xs">Overview</span>
            </Button>
          </div>
        </motion.div>

        {/* Subjects */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold mb-1">Your Subjects</h2>
          <p className="text-muted-foreground mb-4">Select a subject to study with AI assistance</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject, index) => {
            const pendingQ = subject.quizzes.filter(q => q.status === 'not_started').length;
            const pendingA = subject.assignments.filter(a => a.status === 'not_submitted' || a.status === 'overdue').length;

            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 mb-2">
                        {subject.code}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {pendingQ > 0 && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">
                            {pendingQ} quiz
                          </Badge>
                        )}
                        {pendingA > 0 && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0">
                            {pendingA} assgn
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-base leading-snug">{subject.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30">
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{subject.handouts.length}</p>
                        <p className="text-[10px] text-muted-foreground">Handouts</p>
                      </div>
                      <div className="py-1.5 rounded-md bg-purple-50 dark:bg-purple-900/30">
                        <p className="text-sm font-bold text-purple-700 dark:text-purple-400">{subject.videos.length}</p>
                        <p className="text-[10px] text-muted-foreground">Videos</p>
                      </div>
                      <div className="py-1.5 rounded-md bg-blue-50 dark:bg-blue-900/30">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{subject.quizzes.length}</p>
                        <p className="text-[10px] text-muted-foreground">Quizzes</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                        onClick={() => {
                          selectSubject(subject);
                          setView('study');
                        }}
                      >
                        <BookOpen className="mr-1 h-3 w-3" />
                        Study
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 h-8"
                        onClick={() => {
                          selectSubject(subject);
                          setView('quiz');
                        }}
                      >
                        <Brain className="mr-1 h-3 w-3" />
                        Quiz
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ─── Subject View (Enhanced with tabs for Handouts, Videos, Chat, Quiz) ──────
function SubjectView() {
  const selectedSubject = useAppStore((s) => s.selectedSubject);
  const setView = useAppStore((s) => s.setView);
  const goBack = useAppStore((s) => s.goBack);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingMessage = useAppStore((s) => s.loadingMessage);
  const loadHandout = useAppStore((s) => s.loadHandout);
  const loadHandoutDemo = useAppStore((s) => s.loadHandoutDemo);
  const startQuiz = useAppStore((s) => s.startQuiz);
  const studentId = useAppStore((s) => s.studentId);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const sendChatMessage = useAppStore((s) => s.sendChatMessage);
  const selectedHandout = useAppStore((s) => s.selectedHandout);
  const loadVideoSummary = useAppStore((s) => s.loadVideoSummary);

  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('handouts');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isDemo = studentId === 'DEMO-STUDENT';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleHandoutClick = useCallback(
    async (handout: { name: string; url: string }) => {
      try {
        if (isDemo) {
          await loadHandoutDemo(selectedSubject?.code || '', handout.name);
        } else {
          await loadHandout(handout.url, handout.name);
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to load handout', variant: 'destructive' });
      }
    },
    [isDemo, loadHandout, loadHandoutDemo, selectedSubject, toast]
  );

  const handleVideoClick = useCallback(
    async (video: VideoLectureInfo) => {
      try {
        await loadVideoSummary(video);
      } catch {
        toast({ title: 'Error', description: 'Failed to load video summary', variant: 'destructive' });
      }
    },
    [loadVideoSummary, toast]
  );

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    await sendChatMessage(msg);
  };

  const handleStartQuiz = async () => {
    if (!selectedHandout && selectedSubject?.handouts.length === 0) {
      toast({ title: 'No content', description: 'Load a handout first to generate quiz', variant: 'destructive' });
      return;
    }
    await startQuiz(5);
  };

  if (!selectedSubject) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">{selectedSubject.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 text-xs">
                {selectedSubject.code}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedSubject.handouts.length} handouts | {selectedSubject.videos.length} videos | {selectedSubject.quizzes.length} quizzes
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="handouts" className="gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Handouts</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1">
              <Video className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Videos</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-1">
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quiz</span>
            </TabsTrigger>
          </TabsList>

          {/* Handouts Tab */}
          <TabsContent value="handouts">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {selectedSubject.handouts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">No Handouts Found</h3>
                    <p className="text-sm text-muted-foreground">
                      Handouts will appear here once loaded from VULMS
                    </p>
                  </CardContent>
                </Card>
              ) : (
                selectedSubject.handouts.map((handout, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className="group hover:shadow-md transition-all duration-200 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer"
                      onClick={() => handleHandoutClick(handout)}
                    >
                      <CardContent className="py-3 px-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{handout.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{handout.type} file{handout.size ? ` - ${handout.size}` : ''}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors shrink-0" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {selectedSubject.videos.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">No Video Lectures Found</h3>
                    <p className="text-sm text-muted-foreground">
                      Video lectures will appear here once loaded from VULMS
                    </p>
                  </CardContent>
                </Card>
              ) : (
                selectedSubject.videos.map((video, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="group hover:shadow-md transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-700">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                            <Youtube className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{video.name}</p>
                            <p className="text-xs text-muted-foreground">Lecture {video.lessonNumber}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => window.open(video.youtubeUrl, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              YouTube
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => handleVideoClick(video)}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Summary
                            </Button>
                          </div>
                        </div>
                        {/* Video summary */}
                        {video.summary && (
                          <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                              <span className="text-xs font-medium text-purple-700 dark:text-purple-400">AI Summary (Roman Urdu)</span>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-xs max-h-60 overflow-y-auto">
                              <ReactMarkdown>{video.summary}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
              <ScrollArea className="flex-1 pr-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-medium mb-1">Ask about {selectedSubject.code}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Ask any question about your subject and get AI-powered explanations
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {chatMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                            msg.role === 'user'
                              ? 'bg-emerald-600 text-white rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm">{msg.content}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {isLoading && chatMessages.length > 0 && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {loadingMessage || 'Thinking...'}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="mt-3 flex gap-2">
                <Input
                  placeholder={`Ask about ${selectedSubject.code}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 h-11"
                />
                <Button
                  onClick={handleSendChat}
                  disabled={isLoading || !chatInput.trim()}
                  className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          {/* Quiz Tab */}
          <TabsContent value="quiz">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* VULMS Quizzes from LMS */}
              {selectedSubject.quizzes.length > 0 && (
                <Card className="border-blue-200 dark:border-blue-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-blue-600" />
                      VULMS Quizzes
                    </CardTitle>
                    <CardDescription>Your graded quizzes from LMS</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedSubject.quizzes.map((quiz, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <div>
                          <p className="text-sm font-medium">{quiz.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {quiz.openDate && `Open: ${quiz.openDate}`}
                            {quiz.closeDate && ` | Close: ${quiz.closeDate}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {quiz.score && (
                            <Badge variant="secondary" className="text-xs">{quiz.score}</Badge>
                          )}
                          <Badge
                            className={
                              quiz.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              quiz.status === 'not_started' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }
                          >
                            {quiz.status === 'completed' ? 'Done' : quiz.status === 'not_started' ? 'Pending' : quiz.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* AI Practice Quiz */}
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4 mx-auto">
                    <Brain className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-xl mb-1">AI Practice Quiz</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                    Test your knowledge with AI-generated questions from your handouts
                  </p>
                  <Button
                    onClick={handleStartQuiz}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Quiz...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Quiz (5 Questions)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── Study View ───────────────────────────────────────────────────────────────
function StudyView() {
  const selectedHandout = useAppStore((s) => s.selectedHandout);
  const selectedSubject = useAppStore((s) => s.selectedSubject);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingMessage = useAppStore((s) => s.loadingMessage);
  const goBack = useAppStore((s) => s.goBack);
  const setView = useAppStore((s) => s.setView);
  const sendChatMessage = useAppStore((s) => s.sendChatMessage);

  const [askQuestion, setAskQuestion] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);

  const handleAskQuestion = async () => {
    if (!askQuestion.trim()) return;
    const q = askQuestion;
    setAskQuestion('');
    await sendChatMessage(q);
    setView('chat');
  };

  if (!selectedHandout) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate">{selectedHandout.title}</h1>
            <p className="text-xs text-muted-foreground">{selectedSubject?.code}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOriginal(!showOriginal)}
            className="shrink-0 text-xs"
          >
            {showOriginal ? 'AI Explanation' : 'Original'}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    <div>
                      <p className="font-medium">{loadingMessage || 'Loading...'}</p>
                      <p className="text-sm text-muted-foreground">This may take a moment</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-6 w-2/3 mt-4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-lg">
                      {showOriginal ? 'Original Content' : 'AI Explanation'}
                    </CardTitle>
                  </div>
                  <CardDescription>{selectedHandout.title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>
                      {showOriginal ? selectedHandout.content : selectedHandout.explanation || 'Explanation is being generated...'}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-4">
                  <Label className="text-sm font-medium mb-2 block">Ask a question about this topic</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your question here..."
                      value={askQuestion}
                      onChange={(e) => setAskQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAskQuestion();
                      }}
                      className="flex-1 h-10"
                    />
                    <Button
                      onClick={handleAskQuestion}
                      disabled={!askQuestion.trim()}
                      className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}

// ─── Videos View (with summary) ───────────────────────────────────────────────
function VideosView() {
  const selectedVideo = useAppStore((s) => s.selectedVideo);
  const selectedSubject = useAppStore((s) => s.selectedSubject);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingMessage = useAppStore((s) => s.loadingMessage);
  const goBack = useAppStore((s) => s.goBack);

  if (!selectedVideo) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate">{selectedVideo.name}</h1>
            <p className="text-xs text-muted-foreground">{selectedSubject?.code} - Lecture {selectedVideo.lessonNumber}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-red-300 text-red-600"
            onClick={() => window.open(selectedVideo.youtubeUrl, '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open YouTube
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center gap-3 mb-6">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  <div>
                    <p className="font-medium">{loadingMessage || 'Generating summary...'}</p>
                    <p className="text-sm text-muted-foreground">AI is creating a Roman Urdu summary of this lecture</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-6 w-2/3 mt-4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* YouTube Embed */}
              <Card className="mb-6 overflow-hidden">
                <div className="aspect-video">
                  <iframe
                    src={selectedVideo.youtubeUrl.replace('watch?v=', 'embed/')}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              </Card>

              {/* AI Summary */}
              {selectedVideo.summary && (
                <Card className="border-purple-200 dark:border-purple-800/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-lg">AI Summary (Roman Urdu)</CardTitle>
                    </div>
                    <CardDescription>{selectedVideo.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{selectedVideo.summary}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}

// ─── Tracker View (Quizzes + Assignments + GDBs) ──────────────────────────────
function TrackerView() {
  const subjects = useAppStore((s) => s.subjects);
  const goBack = useAppStore((s) => s.goBack);
  const selectSubject = useAppStore((s) => s.selectSubject);
  const setView = useAppStore((s) => s.setView);
  const [activeTab, setActiveTab] = useState('quizzes');

  // Aggregate all quizzes/assignments from all subjects
  const allQuizzes = subjects.flatMap(s =>
    s.quizzes.map(q => ({ ...q, subjectCode: s.code, subjectName: s.name }))
  );
  const allAssignments = subjects.flatMap(s =>
    s.assignments.map(a => ({ ...a, subjectCode: s.code, subjectName: s.name }))
  );
  const allGDBs = subjects.flatMap(s =>
    s.gdbs.map(g => ({ ...g, subjectCode: s.code, subjectName: s.name }))
  );

  const pendingQuizzes = allQuizzes.filter(q => q.status === 'not_started');
  const completedQuizzes = allQuizzes.filter(q => q.status === 'completed');
  const pendingAssignments = allAssignments.filter(a => a.status === 'not_submitted' || a.status === 'overdue');
  const submittedAssignments = allAssignments.filter(a => a.status === 'submitted' || a.status === 'graded');

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-emerald-600" />
            <h1 className="font-bold text-sm">Tracker - Deadlines & Progress</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {/* Progress Overview */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="border-blue-200 dark:border-blue-800/50">
            <CardContent className="py-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Quizzes Progress</span>
                <span className="text-xs text-muted-foreground">{completedQuizzes.length}/{allQuizzes.length}</span>
              </div>
              <Progress value={allQuizzes.length > 0 ? (completedQuizzes.length / allQuizzes.length) * 100 : 0} className="h-2" />
              <p className="text-xs text-blue-600 mt-1">{pendingQuizzes.length} quizzes remaining</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800/50">
            <CardContent className="py-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Assignments Progress</span>
                <span className="text-xs text-muted-foreground">{submittedAssignments.length}/{allAssignments.length}</span>
              </div>
              <Progress value={allAssignments.length > 0 ? (submittedAssignments.length / allAssignments.length) * 100 : 0} className="h-2" />
              <p className="text-xs text-orange-600 mt-1">{pendingAssignments.length} assignments pending</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="quizzes" className="gap-1">
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quizzes</span>
              {pendingQuizzes.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{pendingQuizzes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-1">
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Assignments</span>
              {pendingAssignments.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{pendingAssignments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="gdbs" className="gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">GDBs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quizzes">
            <div className="space-y-3">
              {allQuizzes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">No Quizzes Found</h3>
                    <p className="text-sm text-muted-foreground">Quiz data will appear here once loaded from VULMS</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Pending Quizzes */}
                  {pendingQuizzes.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-yellow-700 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Pending Quizzes ({pendingQuizzes.length})
                      </h3>
                      {pendingQuizzes.map((quiz, i) => (
                        <Card key={i} className="border-yellow-200 dark:border-yellow-800/50">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{quiz.name}</p>
                                <p className="text-xs text-muted-foreground">{quiz.subjectCode} - {quiz.subjectName}</p>
                                {quiz.closeDate && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <CalendarClock className="h-3 w-3 text-yellow-600" />
                                    <span className="text-xs text-yellow-600">Last date: {quiz.closeDate}</span>
                                  </div>
                                )}
                              </div>
                              <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Completed Quizzes */}
                  {completedQuizzes.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h3 className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed Quizzes ({completedQuizzes.length})
                      </h3>
                      {completedQuizzes.map((quiz, i) => (
                        <Card key={i} className="border-emerald-200 dark:border-emerald-800/50">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{quiz.name}</p>
                                <p className="text-xs text-muted-foreground">{quiz.subjectCode} - {quiz.subjectName}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {quiz.score && (
                                  <Badge variant="secondary" className="text-xs">{quiz.score}</Badge>
                                )}
                                <Badge className="bg-emerald-100 text-emerald-700">Done</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="assignments">
            <div className="space-y-3">
              {allAssignments.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">No Assignments Found</h3>
                    <p className="text-sm text-muted-foreground">Assignment data will appear here once loaded from VULMS</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Pending/Overdue Assignments */}
                  {pendingAssignments.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-orange-700 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Pending Assignments ({pendingAssignments.length})
                      </h3>
                      {pendingAssignments.map((assign, i) => (
                        <Card key={i} className={assign.status === 'overdue' ? 'border-red-200 dark:border-red-800/50' : 'border-orange-200 dark:border-orange-800/50'}>
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{assign.name}</p>
                                <p className="text-xs text-muted-foreground">{assign.subjectCode} - {assign.subjectName}</p>
                                {assign.dueDate && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <CalendarClock className="h-3 w-3 text-orange-600" />
                                    <span className={`text-xs ${assign.status === 'overdue' ? 'text-red-600 font-medium' : 'text-orange-600'}`}>
                                      Due: {assign.dueDate} {assign.status === 'overdue' ? '(OVERDUE!)' : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Badge className={assign.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                                {assign.status === 'overdue' ? 'Overdue' : 'Pending'}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Submitted Assignments */}
                  {submittedAssignments.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h3 className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Submitted ({submittedAssignments.length})
                      </h3>
                      {submittedAssignments.map((assign, i) => (
                        <Card key={i} className="border-emerald-200 dark:border-emerald-800/50">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{assign.name}</p>
                                <p className="text-xs text-muted-foreground">{assign.subjectCode} - {assign.subjectName}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {assign.score && (
                                  <Badge variant="secondary" className="text-xs">{assign.score}</Badge>
                                )}
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  {assign.status === 'graded' ? 'Graded' : 'Submitted'}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="gdbs">
            <div className="space-y-3">
              {allGDBs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">No GDBs Found</h3>
                    <p className="text-sm text-muted-foreground">GDB data will appear here once loaded from VULMS</p>
                  </CardContent>
                </Card>
              ) : (
                allGDBs.map((gdb, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{gdb.name}</p>
                          <p className="text-xs text-muted-foreground">{gdb.subjectCode} - {gdb.subjectName}</p>
                          {gdb.closeDate && (
                            <p className="text-xs text-muted-foreground mt-1">Close: {gdb.closeDate}</p>
                          )}
                        </div>
                        <Badge className={gdb.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}>
                          {gdb.status === 'posted' ? 'Posted' : 'Not Posted'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── Notifications View ────────────────────────────────────────────────────────
function NotificationsView() {
  const notifications = useAppStore((s) => s.notifications);
  const goBack = useAppStore((s) => s.goBack);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const selectSubject = useAppStore((s) => s.selectSubject);
  const subjects = useAppStore((s) => s.subjects);
  const setView = useAppStore((s) => s.setView);

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markNotificationRead(notif.id);
    const subject = subjects.find(s => s.code === notif.subjectCode);
    if (subject) {
      selectSubject(subject);
      setView('tracker');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-600" />
            <h1 className="font-bold text-sm">Reminders & Notifications</h1>
          </div>
          {unread.length > 0 && (
            <Badge className="bg-red-100 text-red-700">{unread.length} new</Badge>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No Reminders</h3>
              <p className="text-sm text-muted-foreground">
                You&apos;re all caught up! Notifications for upcoming deadlines will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Urgent (within 2 days) */}
            {unread.filter(n => n.daysLeft <= 2).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  URGENT - Last 2 Days!
                </h3>
                {unread.filter(n => n.daysLeft <= 2).map((notif) => (
                  <Card
                    key={notif.id}
                    className="border-red-200 dark:border-red-800/50 cursor-pointer hover:shadow-md transition-all bg-red-50/50 dark:bg-red-950/20"
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                            {notif.type === 'quiz' ? <Brain className="h-4 w-4 text-red-600" /> :
                             notif.type === 'assignment' ? <ClipboardList className="h-4 w-4 text-red-600" /> :
                             <MessageSquare className="h-4 w-4 text-red-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{notif.subjectCode} - {notif.title}</p>
                            <p className="text-xs text-red-600 font-medium">
                              {notif.daysLeft === 0 ? 'AAJ LAST DAY HAI!' : `${notif.daysLeft} din baaki`}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-red-100 text-red-700 text-[10px]">
                          {notif.type === 'quiz' ? 'Quiz' : notif.type === 'assignment' ? 'Assignment' : 'GDB'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Coming Up (within 7 days) */}
            {unread.filter(n => n.daysLeft > 2 && n.daysLeft <= 7).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-yellow-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Coming Up This Week
                </h3>
                {unread.filter(n => n.daysLeft > 2 && n.daysLeft <= 7).map((notif) => (
                  <Card
                    key={notif.id}
                    className="border-yellow-200 dark:border-yellow-800/50 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center shrink-0">
                            {notif.type === 'quiz' ? <Brain className="h-4 w-4 text-yellow-600" /> :
                             notif.type === 'assignment' ? <ClipboardList className="h-4 w-4 text-yellow-600" /> :
                             <MessageSquare className="h-4 w-4 text-yellow-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{notif.subjectCode} - {notif.title}</p>
                            <p className="text-xs text-yellow-600">{notif.daysLeft} din baaki - Due: {notif.dueDate}</p>
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">
                          {notif.type === 'quiz' ? 'Quiz' : notif.type === 'assignment' ? 'Assignment' : 'GDB'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Later (more than 7 days) */}
            {unread.filter(n => n.daysLeft > 7).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Later
                </h3>
                {unread.filter(n => n.daysLeft > 7).map((notif) => (
                  <Card
                    key={notif.id}
                    className="cursor-pointer hover:shadow-md transition-all"
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            {notif.type === 'quiz' ? <Brain className="h-4 w-4" /> :
                             notif.type === 'assignment' ? <ClipboardList className="h-4 w-4" /> :
                             <MessageSquare className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{notif.subjectCode} - {notif.title}</p>
                            <p className="text-xs text-muted-foreground">{notif.daysLeft} din baaki - Due: {notif.dueDate}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {notif.type === 'quiz' ? 'Quiz' : notif.type === 'assignment' ? 'Assignment' : 'GDB'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Chat View ────────────────────────────────────────────────────────────────
function ChatView() {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const selectedSubject = useAppStore((s) => s.selectedSubject);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingMessage = useAppStore((s) => s.loadingMessage);
  const sendChatMessage = useAppStore((s) => s.sendChatMessage);
  const goBack = useAppStore((s) => s.goBack);

  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const msg = input;
    setInput('');
    await sendChatMessage(msg);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10 flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            <h1 className="font-bold text-sm">Chat - {selectedSubject?.code}</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        <ScrollArea className="flex-1" style={{ height: 'calc(100vh - 180px)' }}>
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-medium mb-1">Start a conversation</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask anything about {selectedSubject?.name || 'your subject'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {loadingMessage || 'Thinking...'}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </ScrollArea>
      </main>

      <div className="sticky bottom-0 border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex gap-2">
          <Input
            placeholder={`Ask about ${selectedSubject?.code || 'subject'}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
            className="flex-1 h-11"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz View ────────────────────────────────────────────────────────────────
function QuizView() {
  const quizQuestions = useAppStore((s) => s.quizQuestions);
  const currentQuestionIndex = useAppStore((s) => s.currentQuestionIndex);
  const quizScore = useAppStore((s) => s.quizScore);
  const quizCompleted = useAppStore((s) => s.quizCompleted);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingMessage = useAppStore((s) => s.loadingMessage);
  const selectedSubject = useAppStore((s) => s.selectedSubject);
  const answerQuiz = useAppStore((s) => s.answerQuiz);
  const nextQuestion = useAppStore((s) => s.nextQuestion);
  const startQuiz = useAppStore((s) => s.startQuiz);
  const goBack = useAppStore((s) => s.goBack);

  if (isLoading || quizQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-emerald-600" />
          <p className="font-medium">{loadingMessage || 'Generating quiz...'}</p>
        </motion.div>
      </div>
    );
  }

  if (quizCompleted && quizScore !== null) {
    const percentage = Math.round((quizScore / quizQuestions.length) * 100);
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-bold text-sm">Quiz Results</h1>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold mb-1">
              {quizScore}/{quizQuestions.length}
            </h2>
            <p className="text-lg text-muted-foreground">{percentage}% Correct</p>
            <Progress value={percentage} className="w-48 mx-auto mt-4 h-2" />
          </motion.div>

          <div className="space-y-4">
            {quizQuestions.map((q, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className={q.userAnswer === q.correctAnswer ? 'border-emerald-300 dark:border-emerald-700' : 'border-red-300 dark:border-red-700'}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      {q.userAnswer === q.correctAnswer ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-2">Q{i + 1}: {q.question}</p>
                        <div className="space-y-1 mb-3">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`text-sm px-3 py-1.5 rounded-md ${
                                oi === q.correctAnswer
                                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-medium'
                                  : oi === q.userAnswer && oi !== q.correctAnswer
                                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                                  : ''
                              }`}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">{q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-3 mt-6 justify-center">
            <Button
              onClick={() => startQuiz(5)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={goBack}>
              Back to Subject
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Active quiz
  const currentQ = quizQuestions[currentQuestionIndex];
  if (!currentQ) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-bold text-sm">Quiz - {selectedSubject?.code}</h1>
          </div>
          <Badge variant="secondary">
            {currentQuestionIndex + 1}/{quizQuestions.length}
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Progress value={((currentQuestionIndex + 1) / quizQuestions.length) * 100} className="h-1.5 mb-6" />

        <motion.div key={currentQuestionIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Question {currentQuestionIndex + 1}
              </CardTitle>
              <CardDescription className="text-base font-medium text-foreground mt-1">
                {currentQ.question}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentQ.options.map((opt, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className={`w-full justify-start text-left h-auto py-3 px-4 ${
                    currentQ.userAnswer === i
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-400'
                      : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                  onClick={() => answerQuiz(currentQuestionIndex, i)}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </Button>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end mt-4">
            <Button
              onClick={nextQuestion}
              disabled={currentQ.userAnswer === undefined}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {currentQuestionIndex + 1 >= quizQuestions.length ? 'Finish Quiz' : 'Next Question'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const view = useAppStore((s) => s.view);

  return (
    <PageTransition viewKey={view}>
      {view === 'login' && <LoginView />}
      {view === 'loading' && <LoadingView />}
      {view === 'dashboard' && <DashboardView />}
      {view === 'study' && <SubjectView />}
      {view === 'chat' && <ChatView />}
      {view === 'quiz' && <QuizView />}
      {view === 'videos' && <VideosView />}
      {view === 'tracker' && <TrackerView />}
      {view === 'notifications' && <NotificationsView />}
    </PageTransition>
  );
}
