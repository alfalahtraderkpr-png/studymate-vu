import { create } from 'zustand';

export type View = 'login' | 'loading' | 'dashboard' | 'study' | 'chat' | 'quiz';

export interface HandoutInfo {
  name: string;
  url: string;
  type: string;
}

export interface SubjectInfo {
  id: string;
  name: string;
  code: string;
  handouts: HandoutInfo[];
}

export interface HandoutContent {
  title: string;
  content: string;
  explanation?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  userAnswer?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AppState {
  // Navigation
  view: View;
  setView: (view: View) => void;

  // Auth
  studentId: string;
  cookies: Array<{ name: string; value: string; domain: string; path: string }>;
  isAuthenticated: boolean;

  // Data
  subjects: SubjectInfo[];
  selectedSubject: SubjectInfo | null;
  selectedHandout: HandoutContent | null;

  // Chat
  chatMessages: ChatMessage[];

  // Quiz
  quizQuestions: QuizQuestion[];
  currentQuestionIndex: number;
  quizScore: number | null;
  quizCompleted: boolean;

  // Loading
  isLoading: boolean;
  loadingMessage: string;

  // Actions
  login: (studentId: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  selectSubject: (subject: SubjectInfo) => void;
  loadHandout: (handoutUrl: string, handoutName: string) => Promise<void>;
  loadHandoutDemo: (subjectCode: string, handoutName: string) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
  startQuiz: (numQuestions?: number) => Promise<void>;
  answerQuiz: (questionIndex: number, answerIndex: number) => void;
  nextQuestion: () => void;
  logout: () => void;
  goBack: () => void;
}

// Demo data
const DEMO_SUBJECTS: SubjectInfo[] = [
  {
    id: '1',
    name: 'CS101 - Introduction to Computing',
    code: 'CS101',
    handouts: [
      { name: 'Lecture 01 - Introduction to Computing', url: '#demo-cs101-l01', type: 'pdf' },
      { name: 'Lecture 02 - History of Computers', url: '#demo-cs101-l02', type: 'pdf' },
      { name: 'Lecture 03 - Computer Architecture', url: '#demo-cs101-l03', type: 'pdf' },
      { name: 'Lecture 04 - Operating Systems', url: '#demo-cs101-l04', type: 'pdf' },
      { name: 'Lecture 05 - Data Representation', url: '#demo-cs101-l05', type: 'pdf' },
    ],
  },
  {
    id: '2',
    name: 'CS201 - Data Structures',
    code: 'CS201',
    handouts: [
      { name: 'Lecture 01 - Introduction to Data Structures', url: '#demo-cs201-l01', type: 'pdf' },
      { name: 'Lecture 02 - Arrays and Linked Lists', url: '#demo-cs201-l02', type: 'pdf' },
      { name: 'Lecture 03 - Stacks and Queues', url: '#demo-cs201-l03', type: 'pdf' },
      { name: 'Lecture 04 - Trees and Binary Trees', url: '#demo-cs201-l04', type: 'pdf' },
      { name: 'Lecture 05 - Graphs', url: '#demo-cs201-l05', type: 'pdf' },
    ],
  },
  {
    id: '3',
    name: 'MGT301 - Principles of Marketing',
    code: 'MGT301',
    handouts: [
      { name: 'Lecture 01 - Marketing Concepts', url: '#demo-mgt301-l01', type: 'pdf' },
      { name: 'Lecture 02 - Marketing Mix (4Ps)', url: '#demo-mgt301-l02', type: 'pdf' },
      { name: 'Lecture 03 - Consumer Behavior', url: '#demo-mgt301-l03', type: 'pdf' },
      { name: 'Lecture 04 - Market Segmentation', url: '#demo-mgt301-l04', type: 'pdf' },
    ],
  },
  {
    id: '4',
    name: 'ENG101 - English Comprehension',
    code: 'ENG101',
    handouts: [
      { name: 'Lecture 01 - Reading Comprehension', url: '#demo-eng101-l01', type: 'pdf' },
      { name: 'Lecture 02 - Grammar and Usage', url: '#demo-eng101-l02', type: 'pdf' },
      { name: 'Lecture 03 - Vocabulary Building', url: '#demo-eng101-l03', type: 'pdf' },
    ],
  },
  {
    id: '5',
    name: 'MTH101 - Calculus And Analytical Geometry',
    code: 'MTH101',
    handouts: [
      { name: 'Lecture 01 - Functions and Limits', url: '#demo-mth101-l01', type: 'pdf' },
      { name: 'Lecture 02 - Derivatives', url: '#demo-mth101-l02', type: 'pdf' },
      { name: 'Lecture 03 - Integration', url: '#demo-mth101-l03', type: 'pdf' },
      { name: 'Lecture 04 - Analytical Geometry', url: '#demo-mth101-l04', type: 'pdf' },
    ],
  },
];

const DEMO_HANDOUT_CONTENTS: Record<string, string> = {
  'CS101-L01': `Introduction to Computing

A computer is an electronic device that processes data according to a set of instructions called a program. The word "computer" comes from the Latin word "computare" which means to calculate.

Types of Computers:
1. Supercomputers - Used for complex scientific calculations
2. Mainframe Computers - Large systems used by organizations
3. Minicomputers - Medium-sized systems for departments
4. Microcomputers/Personal Computers - Individual use

Components of a Computer System:
- Hardware: Physical parts (CPU, Memory, I/O devices)
- Software: Programs and instructions (System software, Application software)
- Data: Raw facts and figures
- Users: People who operate the computer

The Computer System works on the IPO principle:
Input → Process → Output

Von Neumann Architecture:
- CPU (Control Unit + ALU)
- Memory (Primary + Secondary)
- Input/Output Devices
- System Bus (Data, Address, Control)

Key Concepts:
- Bit: Smallest unit of data (0 or 1)
- Byte: 8 bits
- CPU: Brain of the computer
- RAM: Temporary memory
- ROM: Permanent memory`,

  'CS101-L02': `History of Computers

The history of computers can be divided into generations:

First Generation (1940-1956) - Vacuum Tubes:
- ENIAC was the first electronic computer
- Used vacuum tubes for circuitry
- Very large, expensive, and consumed a lot of power
- Used machine language for programming

Second Generation (1956-1963) - Transistors:
- Transistors replaced vacuum tubes
- Smaller, faster, cheaper, and more reliable
- Used assembly language
- Examples: IBM 1401, UNIVAC

Third Generation (1964-1971) - Integrated Circuits:
- ICs replaced transistors
- Even smaller and more efficient
- Operating systems were introduced
- High-level programming languages developed

Fourth Generation (1971-Present) - Microprocessors:
- Microprocessors (VLSI) used
- Personal computers became common
- GUI and internet developed
- Examples: Apple, IBM PC

Fifth Generation (Present-Future) - AI:
- Based on artificial intelligence
- Natural language processing
- Parallel processing
- Quantum computing research`,

  'CS201-L01': `Introduction to Data Structures

A data structure is a way of organizing and storing data in a computer so that it can be accessed and modified efficiently.

Why Data Structures Matter:
- Efficient data access
- Better memory utilization
- Faster processing
- Code organization

Types of Data Structures:
1. Primitive: int, float, char, boolean
2. Non-Primitive:
   a. Linear: Arrays, Linked Lists, Stacks, Queues
   b. Non-Linear: Trees, Graphs

Abstract Data Type (ADT):
- Defines the operations but not the implementation
- Example: Stack ADT defines push, pop, peek operations

Algorithm Analysis:
- Time Complexity: How fast an algorithm runs
- Space Complexity: How much memory an algorithm uses

Big-O Notation:
- O(1): Constant time
- O(log n): Logarithmic
- O(n): Linear
- O(n log n): Linearithmic
- O(n²): Quadratic
- O(2ⁿ): Exponential`,

  'MGT301-L01': `Marketing Concepts

Marketing is the process of creating, communicating, delivering, and exchanging offerings that have value for customers, clients, partners, and society at large.

Core Marketing Concepts:
1. Needs, Wants, and Demands
2. Products and Services
3. Value and Satisfaction
4. Exchange and Relationships
5. Markets

The Marketing Concept:
- Production Concept: Focus on production efficiency
- Product Concept: Focus on product quality
- Selling Concept: Focus on aggressive selling
- Marketing Concept: Focus on customer needs
- Societal Marketing Concept: Focus on social welfare

Marketing Environment:
- Micro Environment: Company, Suppliers, Intermediaries, Customers, Competitors, Publics
- Macro Environment: Demographic, Economic, Natural, Technological, Political, Cultural

Marketing Mix (4Ps):
- Product: What you sell
- Price: How much you charge
- Place: Where you sell
- Promotion: How you advertise`,

  'ENG101-L01': `Reading Comprehension

Reading comprehension is the ability to understand, remember, and communicate meaning from what has been read.

Types of Reading:
1. Skimming: Quick reading for main ideas
2. Scanning: Looking for specific information
3. Intensive Reading: Detailed, careful reading
4. Extensive Reading: Reading for pleasure/general understanding

Key Comprehension Skills:
- Understanding main idea
- Identifying supporting details
- Making inferences
- Drawing conclusions
- Understanding vocabulary in context
- Recognizing author's purpose

Strategies for Better Comprehension:
1. Preview the text before reading
2. Set a purpose for reading
3. Make predictions
4. Ask questions while reading
5. Visualize the content
6. Summarize what you've read
7. Connect to prior knowledge`,

  'MTH101-L01': `Functions and Limits

A function is a relation between a set of inputs and a set of permissible outputs with the property that each input is related to exactly one output.

Function Notation: f(x) = y

Types of Functions:
1. Linear: f(x) = mx + b
2. Quadratic: f(x) = ax² + bx + c
3. Polynomial: f(x) = aₙxⁿ + ... + a₁x + a₀
4. Rational: f(x) = P(x)/Q(x)
5. Trigonometric: sin(x), cos(x), tan(x)
6. Exponential: f(x) = aˣ
7. Logarithmic: f(x) = logₐ(x)

Limits:
The limit of f(x) as x approaches a is L, written as:
lim(x→a) f(x) = L

Properties of Limits:
- lim[f(x) + g(x)] = lim f(x) + lim g(x)
- lim[f(x) · g(x)] = lim f(x) · lim g(x)
- lim[f(x)/g(x)] = lim f(x) / lim g(x), if lim g(x) ≠ 0

Continuity:
A function f is continuous at a if:
1. f(a) exists
2. lim(x→a) f(x) exists
3. lim(x→a) f(x) = f(a)`,
};

function getDemoHandoutKey(subjectCode: string, handoutName: string): string {
  const lecMatch = handoutName.match(/Lecture\s+(\d+)/i);
  const lecNum = lecMatch ? lecMatch[1].padStart(2, '0') : '01';
  return `${subjectCode}-L${lecNum}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  view: 'login',
  setView: (view) => set({ view }),

  // Auth
  studentId: '',
  cookies: [],
  isAuthenticated: false,

  // Data
  subjects: [],
  selectedSubject: null,
  selectedHandout: null,

  // Chat
  chatMessages: [],

  // Quiz
  quizQuestions: [],
  currentQuestionIndex: 0,
  quizScore: null,
  quizCompleted: false,

  // Loading
  isLoading: false,
  loadingMessage: '',

  // Actions
  login: async (studentId: string, password: string) => {
    set({ isLoading: true, loadingMessage: 'Connecting to VULMS...', view: 'loading' });

    try {
      set({ loadingMessage: 'Logging into VULMS (this may take 15-30 seconds)...' });

      const res = await fetch('/api/vulms/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      set({ loadingMessage: 'Loading your subjects...' });

      const subjectsWithIds = (data.subjects || []).map(
        (s: { name: string; code: string; url: string }, i: number) => ({
          id: String(i + 1),
          name: s.name,
          code: s.code,
          handouts: [] as HandoutInfo[],
        })
      );

      set({
        studentId,
        cookies: data.cookies,
        subjects: subjectsWithIds,
        isAuthenticated: true,
        isLoading: false,
        view: 'dashboard',
      });

      // Fetch handouts for each subject in background
      const { cookies } = get();
      for (let i = 0; i < (data.subjects || []).length; i++) {
        try {
          set({ loadingMessage: `Loading handouts for ${(data.subjects[i] as {name: string}).name}...` });
          const handoutRes = await fetch('/api/vulms/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies, sessionUrl: (data.subjects[i] as {url: string}).url }),
          });
          const handoutData = await handoutRes.json();
          if (handoutData.handouts && handoutData.handouts.length > 0) {
            const { subjects } = get();
            const updatedSubjects = [...subjects];
            updatedSubjects[i] = {
              ...updatedSubjects[i],
              handouts: handoutData.handouts,
            };
            set({ subjects: updatedSubjects });
          }
        } catch {
          // Skip failed handout fetches
        }
      }
    } catch (error) {
      set({
        isLoading: false,
        loadingMessage: '',
        view: 'login',
      });
      throw error;
    }
  },

  loginDemo: async () => {
    set({ isLoading: true, loadingMessage: 'Loading demo data...', view: 'loading' });

    // Simulate loading delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    set({
      studentId: 'DEMO-STUDENT',
      cookies: [],
      subjects: DEMO_SUBJECTS,
      isAuthenticated: true,
      isLoading: false,
      view: 'dashboard',
    });
  },

  selectSubject: (subject) => {
    set({ selectedSubject: subject, chatMessages: [], quizQuestions: [], quizScore: null, quizCompleted: false, currentQuestionIndex: 0 });
  },

  loadHandout: async (handoutUrl, handoutName) => {
    const { cookies } = get();
    set({ isLoading: true, loadingMessage: 'Loading handout content...' });

    try {
      const res = await fetch('/api/vulms/handout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies, handoutUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load handout');
      }

      set({
        selectedHandout: { title: data.title || handoutName, content: data.content },
        isLoading: true,
        loadingMessage: 'AI is explaining this topic...',
        view: 'study',
      });

      // Get AI explanation
      const { selectedSubject } = get();
      const explainRes = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: data.content,
          subjectName: selectedSubject?.name || '',
          topicName: handoutName,
        }),
      });

      const explainData = await explainRes.json();

      set({
        selectedHandout: {
          title: data.title || handoutName,
          content: data.content,
          explanation: explainData.explanation || '',
        },
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadHandoutDemo: async (subjectCode, handoutName) => {
    set({ isLoading: true, loadingMessage: 'Loading handout content...' });

    // Simulate loading
    await new Promise((resolve) => setTimeout(resolve, 800));

    const key = getDemoHandoutKey(subjectCode, handoutName);
    const content = DEMO_HANDOUT_CONTENTS[key] || DEMO_HANDOUT_CONTENTS['CS101-L01'] || 'Content not available';

    set({
      selectedHandout: { title: handoutName, content },
      isLoading: true,
      loadingMessage: 'AI is explaining this topic...',
      view: 'study',
    });

    // Get AI explanation
    const { selectedSubject } = get();
    try {
      const explainRes = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          subjectName: selectedSubject?.name || subjectCode,
          topicName: handoutName,
        }),
      });

      const explainData = await explainRes.json();

      set({
        selectedHandout: {
          title: handoutName,
          content,
          explanation: explainData.explanation || '',
        },
        isLoading: false,
      });
    } catch {
      set({
        selectedHandout: { title: handoutName, content },
        isLoading: false,
      });
    }
  },

  sendChatMessage: async (message) => {
    const { chatMessages, selectedSubject, selectedHandout } = get();

    const userMessage: ChatMessage = { role: 'user', content: message };
    const updatedMessages = [...chatMessages, userMessage];
    set({ chatMessages: updatedMessages, isLoading: true, loadingMessage: 'AI is thinking...' });

    try {
      const subjectContext = selectedHandout
        ? `Subject: ${selectedSubject?.name}\nTopic: ${selectedHandout.title}\nContent: ${selectedHandout.content}`
        : `Subject: ${selectedSubject?.name}`;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          subjectContext,
        }),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.',
      };

      set({
        chatMessages: [...updatedMessages, assistantMessage],
        isLoading: false,
      });
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      set({
        chatMessages: [...updatedMessages, errorMessage],
        isLoading: false,
      });
    }
  },

  startQuiz: async (numQuestions = 5) => {
    const { selectedSubject, selectedHandout } = get();
    set({ isLoading: true, loadingMessage: 'Generating quiz questions...', quizQuestions: [], quizScore: null, quizCompleted: false, currentQuestionIndex: 0 });

    const content = selectedHandout?.content || '';
    const subjectName = selectedSubject?.name || '';

    try {
      const res = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, subjectName, numQuestions }),
      });

      const data = await res.json();

      set({
        quizQuestions: data.questions || [],
        isLoading: false,
        view: 'quiz',
        quizScore: null,
        quizCompleted: false,
        currentQuestionIndex: 0,
      });
    } catch {
      set({ isLoading: false, quizQuestions: [] });
    }
  },

  answerQuiz: (questionIndex, answerIndex) => {
    const { quizQuestions } = get();
    const updated = [...quizQuestions];
    updated[questionIndex] = { ...updated[questionIndex], userAnswer: answerIndex };
    set({ quizQuestions: updated });
  },

  nextQuestion: () => {
    const { currentQuestionIndex, quizQuestions } = get();
    if (currentQuestionIndex + 1 >= quizQuestions.length) {
      // Calculate score
      const score = quizQuestions.reduce((acc, q) => {
        return acc + (q.userAnswer === q.correctAnswer ? 1 : 0);
      }, 0);
      set({ quizCompleted: true, quizScore: score });
    } else {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  logout: () => {
    set({
      view: 'login',
      studentId: '',
      cookies: [],
      isAuthenticated: false,
      subjects: [],
      selectedSubject: null,
      selectedHandout: null,
      chatMessages: [],
      quizQuestions: [],
      quizScore: null,
      quizCompleted: false,
      currentQuestionIndex: 0,
      isLoading: false,
      loadingMessage: '',
    });
  },

  goBack: () => {
    const { view } = get();
    if (view === 'study' || view === 'chat' || view === 'quiz') {
      set({ view: 'dashboard', selectedHandout: null, chatMessages: [], quizQuestions: [] });
    } else if (view === 'dashboard') {
      // Stay on dashboard, no back
    }
  },
}));
