import { useState, useEffect, useRef, FormEvent } from 'react';
import { Task, ScheduleBlock, RescueMatrix, ProcrastinationResult } from './types';
import { 
  getDemoTasksDefault, 
  formatDeadlinePretty, 
  simulateProcrastination, 
  simulateGeminiOfflineOutputs 
} from './utils';

export default function App() {
  // --- APPLICATION STATES ---
  const [appTasks, setAppTasks] = useState<Task[]>([]);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [currentFilter, setCurrentFilter] = useState<string>('all');
  const [addedPrioSelected, setAddedPrioSelected] = useState<'High' | 'Medium' | 'Low'>('Medium');
  
  // Modals
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Settings / API config
  const [opsMode, setOpsMode] = useState<string>('demo');
  const [geminiKey, setGeminiKey] = useState<string>('');

  // Procrastination Simulator state
  const [simTaskId, setSimTaskId] = useState<string>('');
  const [simDays, setSimDays] = useState<number | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<ProcrastinationResult | null>(null);

  // Schedule page state
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);
  const [activeSchedule, setActiveSchedule] = useState<ScheduleBlock[]>([]);

  // Rescue mode state
  const [crisisDescription, setCrisisDescription] = useState<string>('');
  const [rescueLoading, setRescueLoading] = useState<boolean>(false);
  const [rescueMatrix, setRescueMatrix] = useState<RescueMatrix | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'warn' }[]>([]);

  // Add Task Form Inputs
  const [addTaskTitle, setAddTaskTitle] = useState<string>('');
  const [addTaskDeadline, setAddTaskDeadline] = useState<string>('');
  const [addTaskEstTime, setAddTaskEstTime] = useState<string>('');

  // Settings inputs (for temporary buffering before saving)
  const [settingsOpsModeInput, setSettingsOpsModeInput] = useState<string>('demo');
  const [settingsKeyInput, setSettingsKeyInput] = useState<string>('');

  // --- REFS FOR CHARTS ---
  const priorityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const doughnutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const priorityChartInstance = useRef<any>(null);
  const doughnutChartInstance = useRef<any>(null);
  const lineChartInstance = useRef<any>(null);

  // --- INITIAL LOAD ---
  useEffect(() => {
    // Load tasks
    let storedTasks = localStorage.getItem('deadline_guardian_tasks');
    if (!storedTasks) {
      const defaults = getDemoTasksDefault();
      localStorage.setItem('deadline_guardian_tasks', JSON.stringify(defaults));
      setAppTasks(defaults);
    } else {
      setAppTasks(JSON.parse(storedTasks));
    }

    // Load configs
    const storedMode = localStorage.getItem('deadline_guardian_ops_mode') || 'demo';
    const storedKey = localStorage.getItem('deadline_guardian_gemini_key') || '';
    setOpsMode(storedMode);
    setGeminiKey(storedKey);
    setSettingsOpsModeInput(storedMode);
    setSettingsKeyInput(storedKey);

    // Load active schedule
    const storedSchedule = localStorage.getItem('deadline_guardian_active_schedule');
    if (storedSchedule) {
      setActiveSchedule(JSON.parse(storedSchedule));
    }

    // Load active rescue matrix
    const storedRescue = localStorage.getItem('deadline_guardian_rescue_matrix');
    if (storedRescue) {
      setRescueMatrix(JSON.parse(storedRescue));
    }
  }, []);

  // --- CHART RENDERING HOOK ---
  useEffect(() => {
    if (currentTab !== 'dashboard' || appTasks.length === 0) return;

    // Grab Chart.js from window
    const ChartClass = (window as any).Chart;
    if (!ChartClass) {
      console.warn("Chart.js not found on window object. CDNs might still be loading.");
      return;
    }

    // 1. Priority Bar Chart
    if (priorityCanvasRef.current) {
      const counts = { High: 0, Medium: 0, Low: 0 };
      appTasks.forEach(t => {
        if (t.status === 'Pending' && counts[t.priority] !== undefined) {
          counts[t.priority]++;
        }
      });

      if (priorityChartInstance.current) {
        priorityChartInstance.current.destroy();
      }

      const ctx = priorityCanvasRef.current.getContext('2d');
      if (ctx) {
        priorityChartInstance.current = new ChartClass(ctx, {
          type: 'bar',
          data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [{
              data: [counts.High, counts.Medium, counts.Low],
              backgroundColor: ['rgba(244, 63, 94, 0.15)', 'rgba(245, 158, 11, 0.15)', 'rgba(16, 185, 129, 0.15)'],
              borderColor: ['#F43F5E', '#F59E0B', '#10B981'],
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.03)' },
                ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 1 }
              },
              y: {
                grid: { display: false },
                ticks: { color: '#f3f4f6', font: { family: 'Inter', size: 10 } }
              }
            }
          }
        });
      }
    }

    // 2. Completion Ratio Doughnut Chart
    if (doughnutCanvasRef.current) {
      const active = appTasks.filter(t => t.status === 'Pending').length;
      const completed = appTasks.filter(t => t.status === 'Completed').length;

      if (doughnutChartInstance.current) {
        doughnutChartInstance.current.destroy();
      }

      const ctx = doughnutCanvasRef.current.getContext('2d');
      if (ctx) {
        const dataValues = active === 0 && completed === 0 ? [0, 1] : [completed, active];
        const dataColors = active === 0 && completed === 0 
          ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)'] 
          : ['rgba(99, 102, 241, 0.25)', 'rgba(255, 255, 255, 0.03)'];
        const borderColors = active === 0 && completed === 0 
          ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.1)'] 
          : ['#6366F1', 'rgba(255, 255, 255, 0.08)'];

        doughnutChartInstance.current = new ChartClass(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Completed Today', 'Active Pending'],
            datasets: [{
              data: dataValues,
              backgroundColor: dataColors,
              borderColor: borderColors,
              borderWidth: 1.5,
              cutout: '72%'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: '#9ca3af',
                  font: { family: 'Inter', size: 10 },
                  boxWidth: 8,
                  padding: 12
                }
              }
            }
          }
        });
      }
    }

    // 3. Weekly Trend Line Chart
    if (lineCanvasRef.current) {
      const completedCount = appTasks.filter(t => t.status === 'Completed').length;
      const dailyTrend = [
        Math.max(1, Math.round(completedCount * 0.3)),
        Math.max(2, Math.round(completedCount * 0.5)),
        Math.max(1, Math.round(completedCount * 0.4)),
        Math.max(3, Math.round(completedCount * 0.7)),
        Math.max(2, Math.round(completedCount * 0.6)),
        Math.max(4, Math.round(completedCount * 0.9)),
        completedCount
      ];

      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }

      const ctx = lineCanvasRef.current.getContext('2d');
      if (ctx) {
        lineChartInstance.current = new ChartClass(ctx, {
          type: 'line',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
              label: 'Milestones Done',
              data: dailyTrend,
              backgroundColor: 'rgba(16, 185, 129, 0.03)',
              borderColor: '#10B981',
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#10B981',
              pointRadius: 2,
              pointHoverRadius: 5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 9 } }
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.03)' },
                ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 1 }
              }
            }
          }
        });
      }
    }

    return () => {
      if (priorityChartInstance.current) priorityChartInstance.current.destroy();
      if (doughnutChartInstance.current) doughnutChartInstance.current.destroy();
      if (lineChartInstance.current) lineChartInstance.current.destroy();
    };
  }, [currentTab, appTasks]);

  // --- AUTOMATIC SELECT PREPOPULATION FOR SIMULATOR ---
  useEffect(() => {
    const pendings = appTasks.filter(t => t.status === 'Pending');
    if (pendings.length > 0 && !simTaskId) {
      setSimTaskId(pendings[0].id);
    }
  }, [appTasks, simTaskId]);

  // --- TOAST SERVICE ---
  const showToast = (message: string, type: 'success' | 'error' | 'warn' = 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // --- CORE SYSTEM METHODS ---
  const calculateProductivityScore = () => {
    const total = appTasks.length;
    if (total === 0) return 100;
    const completed = appTasks.filter(t => t.status === 'Completed').length;
    const overdue = appTasks.filter(t => t.status === 'Pending' && new Date(t.deadline) < new Date()).length;
    const prioritizeCount = parseInt(localStorage.getItem('ai_prio_count') || '1');
    const aiAccuracyBonus = Math.min(15, prioritizeCount * 5); // caps at 15
    
    const baseScore = (completed / total) * 100;
    const penalty = overdue * 5;
    
    const finalScore = Math.round(baseScore - penalty + aiAccuracyBonus);
    return Math.max(0, Math.min(100, finalScore));
  };

  const getProductivityBarColor = (score: number) => {
    if (score < 40) return 'bg-emergencyRed';
    if (score < 75) return 'bg-warnOrange';
    return 'bg-successGreen';
  };

  const handleTaskStatusToggle = (taskId: string) => {
    const updated = appTasks.map(t => {
      if (t.id === taskId) {
        const nextStatus: 'Pending' | 'Completed' = t.status === 'Completed' ? 'Pending' : 'Completed';
        if (nextStatus === 'Completed') {
          showToast(`Task Completed: "${t.title}"! Excellent productivity streak!`, 'success');
        } else {
          showToast(`Task active again: "${t.title}"`, 'warn');
        }
        return { ...t, status: nextStatus };
      }
      return t;
    });
    setAppTasks(updated);
    localStorage.setItem('deadline_guardian_tasks', JSON.stringify(updated));
  };

  const handleTaskSnooze = (taskId: string) => {
    const updated = appTasks.map(t => {
      if (t.id === taskId) {
        const nextCount = t.snoozeCount + 1;
        // Add 2 hours to deadline
        const nextDeadline = new Date(new Date(t.deadline).getTime() + 2 * 3600 * 1000).toISOString().slice(0, 16);
        const isRisk = nextCount > 2;

        if (isRisk) {
          showToast(`⚠️ High Procrastination flag on "${t.title}". Action needed to break task blocks!`, 'warn');
        } else {
          showToast(`Task "${t.title}" snoozed 2 hours. Adjusted deadline saved.`, 'success');
        }

        return {
          ...t,
          snoozeCount: nextCount,
          deadline: nextDeadline,
          procrastinationRisk: isRisk || t.procrastinationRisk
        };
      }
      return t;
    });
    setAppTasks(updated);
    localStorage.setItem('deadline_guardian_tasks', JSON.stringify(updated));
  };

  const handleTaskDelete = (taskId: string) => {
    const idx = appTasks.findIndex(t => t.id === taskId);
    if (idx > -1) {
      const title = appTasks[idx].title;
      const updated = appTasks.filter(t => t.id !== taskId);
      setAppTasks(updated);
      localStorage.setItem('deadline_guardian_tasks', JSON.stringify(updated));
      showToast(`Wiped Task: "${title}"`, 'success');
    }
  };

  const handleMicroStepToggle = (taskId: string) => {
    const updated = appTasks.map(t => {
      if (t.id === taskId) {
        const nextState = !t.microStepCompleted;
        if (nextState) {
          showToast("Micro-step completed! Inertia defeated. Keep pushing!", 'success');
        }
        return { ...t, microStepCompleted: nextState };
      }
      return t;
    });
    setAppTasks(updated);
    localStorage.setItem('deadline_guardian_tasks', JSON.stringify(updated));
  };

  // --- ADD TASK DISPATCH ---
  const handleAddTaskSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!addTaskTitle || !addTaskDeadline) {
      showToast("Please provide all required details.", "warn");
      return;
    }

    const newTask: Task = {
      id: "task_" + Date.now(),
      title: addTaskTitle,
      deadline: addTaskDeadline,
      priority: addedPrioSelected,
      estTime: parseFloat(addTaskEstTime) || 1.0,
      status: "Pending",
      snoozeCount: 0,
      procrastinationRisk: false,
      microStep: null,
      microStepCompleted: false,
      aiReason: ""
    };

    const updated = [...appTasks, newTask];
    setAppTasks(updated);
    localStorage.setItem('deadline_guardian_tasks', JSON.stringify(updated));
    showToast(`Successfully locked: "${addTaskTitle}" inside Vault.`, 'success');

    // Reset fields
    setAddTaskTitle('');
    setAddTaskDeadline('');
    setAddTaskEstTime('');
    setAddedPrioSelected('Medium');
    setIsAddTaskModalOpen(false);
  };

  // --- SYSTEM CONFIG SAVER ---
  const handleSaveSettings = () => {
    if (settingsOpsModeInput === 'api' && !settingsKeyInput.trim()) {
      showToast("Gemini token key is required for active API configurations.", "warn");
      return;
    }

    localStorage.setItem('deadline_guardian_ops_mode', settingsOpsModeInput);
    localStorage.setItem('deadline_guardian_gemini_key', settingsKeyInput.trim());

    setOpsMode(settingsOpsModeInput);
    setGeminiKey(settingsKeyInput.trim());

    showToast("System Operation settings stored successfully.", "success");
    setIsSettingsModalOpen(false);
  };

  const handleResetToDemoData = () => {
    localStorage.removeItem('deadline_guardian_tasks');
    localStorage.removeItem('deadline_guardian_active_schedule');
    localStorage.removeItem('deadline_guardian_rescue_matrix');
    localStorage.removeItem('ai_prio_count');

    const defaults = getDemoTasksDefault();
    localStorage.setItem('deadline_guardian_tasks', JSON.stringify(defaults));
    setAppTasks(defaults);
    setActiveSchedule([]);
    setRescueMatrix(null);

    setCurrentTab('dashboard');
    showToast("Default demo tasks loaded, app parameters reset.", "success");
    setIsSettingsModalOpen(false);
  };

  const handleClearAppCache = () => {
    localStorage.clear();
    handleResetToDemoData();
    showToast("App localStorage fully wiped clean.", "success");
  };

  // --- GEMINI DIRECT CLIENT SERVICE ---
  const fetchGeminiDirect = async (promptText: string, responseSchema: any = null, crisisDesc?: string): Promise<any> => {
    if (opsMode === 'demo' || !geminiKey) {
      console.log("Gateway Running offline simulation mode.");
      await new Promise(resolve => setTimeout(resolve, 1200));
      return simulateGeminiOfflineOutputs(promptText, appTasks, crisisDesc);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      
      const configParams: any = {
        responseMimeType: "application/json"
      };
      if (responseSchema) {
        configParams.responseSchema = responseSchema;
      }

      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: configParams
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`API returned status code ${response.status}: ${detail}`);
      }

      const result = await response.json();
      if (!result.candidates || result.candidates.length === 0) {
        throw new Error("Empty threat vectors / no candidates came from model");
      }

      const rawText = result.candidates[0].content.parts[0].text;
      return JSON.parse(rawText.trim());
    } catch (err: any) {
      console.warn("Direct connection failure. Prompted fallback loop.", err);
      showToast(`Gemini direct query failed: ${err.message}. Invoking backup high-fidelity simulator.`, "error");
      return simulateGeminiOfflineOutputs(promptText, appTasks, crisisDesc);
    }
  };

  // --- AI INTERACTION - SNOOZE IMPACT SIMULATOR ---
  const calculateSnoozeImpact = async (days: number) => {
    if (!simTaskId) {
      showToast("Create a task first to simulate a crisis!", "warn");
      return;
    }

    const task = appTasks.find(t => t.id === simTaskId);
    if (!task) {
      showToast("Task not found in local vault.", "error");
      return;
    }

    setSimDays(days);
    setSimLoading(true);
    setSimResult(null);

    try {
      let predictionData: ProcrastinationResult;

      if (opsMode === 'api' && geminiKey) {
        const prompt = `You are Aheadly AI, an elegant intelligent focus advisor. Calculate the real scheduling outcomes and cascading impacts of postponing the task titled "${task.title}" (Priority: ${task.priority}, Hours estimated: ${task.estTime}) by exactly ${days} days.
        Return a JSON object matching this exact schema:
        {
          "threatLevel": "CRITICAL SHOCK" or "MODERATE RISK" or "SENSITIVE IMPACT",
          "riskFactor": 1.2 to 4.5,
          "headline": "A short dramatic punchline of what collapses",
          "critique": "A brief, ultra-sarcastic but accurate psychological warning critique (max 18 words) of the user delaying this",
          "bulletThreats": ["Detailed timeline collapse point 1", "Detailed gridlock collapse point 2"]
        }
        Do not include any wrapping markdown. Only return pure JSON.`;
        
        predictionData = await fetchGeminiDirect(prompt);
      } else {
        await new Promise(resolve => setTimeout(resolve, 750));
        predictionData = simulateProcrastination(task, days);
      }

      setSimResult(predictionData);
    } catch (err) {
      console.error("Procrastination simulator error: ", err);
      showToast("Error executing procrastination simulator calculations.", "error");
    } finally {
      setSimLoading(false);
    }
  };

  // --- AI INTERACTION - INTELLIGENT SORTING ---
  const triggerAIPrioritization = async () => {
    const pendingTasks = appTasks.filter(t => t.status === 'Pending');
    if (pendingTasks.length === 0) {
      showToast("No active task lists inside standard queue to prioritize.", "warn");
      return;
    }

    showToast("Triggering smart priority vector sorting, please wait...", "success");

    const promptText = `
      System Instructions: You are a elite productivity advisor and deadline defense expert.
      Analyze the following tasks considering deadline values relative to 'Date: Tuesday, June 23, 2026'.
      Adjust the task priority ratings dynamically to align with extreme threats.
      
      The tasks data:
      ${JSON.stringify(pendingTasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline, priority: t.priority, estTime: t.estTime })))}
      
      Format a highly refined JSON array with strictly matching schemas containing:
      - "taskId" matching input id properties
      - "newPriority" string restricted to: "High", "Medium", "Low"
      - "reason" string detailing optimization rationale
    `;

    const schemaTemplate = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          taskId: { type: "STRING" },
          newPriority: { type: "STRING", enum: ["High", "Medium", "Low"] },
          reason: { type: "STRING" }
        },
        required: ["taskId", "newPriority", "reason"]
      }
    };

    try {
      const feedback = await fetchGeminiDirect(promptText, schemaTemplate);
      
      if (Array.isArray(feedback)) {
        const updated = appTasks.map(task => {
          const fit = feedback.find((item: any) => item.taskId === task.id);
          if (fit) {
            return { ...task, priority: fit.newPriority, aiReason: fit.reason };
          }
          return task;
        });

        const currentPrioCount = parseInt(localStorage.getItem('ai_prio_count') || '1') + 1;
        localStorage.setItem('ai_prio_count', currentPrioCount.toString());

        setAppTasks(updated);
        localStorage.setItem('deadline_guardian_tasks', JSON.stringify(updated));
        showToast("AI Prioritization execution saved! Dashboard parameters refreshed.", "success");
      } else {
        throw new Error("Invalid structure returned");
      }
    } catch (err) {
      console.error(err);
      showToast("Parser fail on AI output. Please re-run.", "error");
    }
  };

  // --- AI INTERACTION - GENERATE DAILY TIMELINE ---
  const generateAISchedule = async () => {
    const pendingTasks = appTasks.filter(t => t.status === 'Pending');
    if (pendingTasks.length === 0) {
      showToast("No pending items available to schedule.", "warn");
      return;
    }

    setScheduleLoading(true);

    const promptText = `
      System Instructions: Build a bulletproof hour-by-hour productive timeline schedule starting tomorrow 8:00 AM.
      Target sequence order: priority tier mapping, total effort estimates, and threat constraints to avoid overlaps.
      
      The tasks:
      ${JSON.stringify(pendingTasks.map(t => ({ title: t.title, priority: t.priority, estTime: t.estTime, deadline: t.deadline })))}
      
      Return a beautiful JSON array:
      - "time" string (e.g. "8:00 AM", "12:30 PM", "6:00 PM")
      - "action" string describing active duty / block
      - "duration" string highlighting duration time (e.g. "2 hrs", "1.5 hrs", "30 mins")
    `;

    const schemaTemplate = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          time: { type: "STRING" },
          action: { type: "STRING" },
          duration: { type: "STRING" }
        },
        required: ["time", "action", "duration"]
      }
    };

    try {
      const feedback = await fetchGeminiDirect(promptText, schemaTemplate);
      
      if (Array.isArray(feedback) && feedback.length > 0) {
        setActiveSchedule(feedback);
        localStorage.setItem('deadline_guardian_active_schedule', JSON.stringify(feedback));
        showToast("New smart schedule plan completed!", "success");
      } else {
        throw new Error("Null / empty timeline array elements in response");
      }
    } catch (err) {
      console.error(err);
      showToast("Error parsing Schedule sequence structure.", "error");
    } finally {
      setScheduleLoading(false);
    }
  };

  // --- AI INTERACTION - CRISIS RESCUE MODE ---
  const triggerRescueWorkflow = async () => {
    if (!crisisDescription.trim()) {
      showToast("Please provide exact elements describing your crisis details first.", "warn");
      return;
    }

    const pendingTasks = appTasks.filter(t => t.status === 'Pending');
    setRescueLoading(true);
    setRescueMatrix(null);

    const promptText = `
      System Instructions: Action emergency threat defense triage! 
      
      CRITICAL ROLE: You are an elite productivity advisor. A user has presented a severe crisis scenario: "${crisisDescription}".
      
      Your main directive is to make this described crisis the absolute PRIMARY focus of the emergency rescue plan.
      
      Step 1: Analyze the user's crisis description to extract and identify:
      - Main Task/Event (e.g. exam, presentation, coding deployment)
      - Implied or explicit deadline (e.g. tomorrow morning, 8 AM tomorrow, in 3 hours)
      - Urgency level
      - Estimated effort required
      - Important keywords/topics (e.g. if presentation is on "global warming", keywords are slide structure, core facts, presentation rehearsal)
      
      Step 2: Generate an emergency response centered entirely on resolving this newly described crisis. 
      - The primary item in 'reprioritizedTaskList' and the 'quickstartAction' MUST be directly related to this crisis.
      - Create tactical action items to cover first or prepare for the event.
      - The 'emergencyTimeline' MUST represent a custom countdown timeline for this specific crisis (e.g. T-minus 12h, T-minus 6h, or similar increments suitable to the deadline).
      
      Step 3: Handle existing tasks as SECONDARY context.
      Here are the user's existing pending tasks in their dashboard:
      ${JSON.stringify(pendingTasks.map(t => ({ title: t.title, priority: t.priority, deadline: t.deadline })))}
      
      Use this list ONLY to identify secondary tasks that should be postponed or abandoned in order to clear immediate calendar space and mental bandwidth for the primary crisis.
      DO NOT list any of these unrelated existing tasks as part of the primary action plan, tactical steps, quickstart actions, or timeline (unless indicating that they are being deferred/rescheduled).
      
      Format a highly urgent JSON object structural response matching:
      {
        "reprioritizedTaskList": [
          { "title": "Primary crisis preparation task/step 1", "reason": "Specific strategic reason detailing topics/actions to cover first based on the crisis" },
          { "title": "Primary crisis preparation task/step 2", "reason": "Specific prep step details" }
        ],
        "tasksToPostpone": [
          { "title": "Name of an existing task from the pending tasks list that can be deferred", "postponeReason": "Why deferring this existing task is safe and unlocks critical hours for the crisis" }
        ],
        "tasksToAbandon": [
          { "title": "Name of an existing task or minor activity to drop", "abandonReason": "Why dropping this task is essential to eliminate cognitive fatigue right now" }
        ],
        "quickstartAction": "A single ridiculously easy, 5-minute microscopic first action step related to the crisis to break procrastination inertia immediately",
        "emergencyTimeline": [
          { "time": "Time increment (e.g., T-minus 12h or specific time)", "action": "Crisp preparation action for the crisis", "risk": "High/Medium/Low" }
        ],
        "estimatedSuccessProbability": integerPercentage (strictly a positive Number 1 - 100 representing realistic odds)
      }
    `;

    const schemaTemplate = {
      type: "OBJECT",
      properties: {
        reprioritizedTaskList: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              reason: { type: "STRING" }
            },
            required: ["title", "reason"]
          }
        },
        tasksToPostpone: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              postponeReason: { type: "STRING" }
            },
            required: ["title", "postponeReason"]
          }
        },
        tasksToAbandon: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              abandonReason: { type: "STRING" }
            },
            required: ["title", "abandonReason"]
          }
        },
        quickstartAction: { type: "STRING" },
        emergencyTimeline: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              time: { type: "STRING" },
              action: { type: "STRING" },
              risk: { type: "STRING" }
            },
            required: ["time", "action", "risk"]
          }
        },
        estimatedSuccessProbability: { type: "INTEGER" }
      },
      required: ["reprioritizedTaskList", "tasksToPostpone", "tasksToAbandon", "quickstartAction", "emergencyTimeline", "estimatedSuccessProbability"]
    };

    try {
      const feedback = await fetchGeminiDirect(promptText, schemaTemplate, crisisDescription);
      
      if (feedback && typeof feedback === 'object') {
        setRescueMatrix(feedback);
        localStorage.setItem('deadline_guardian_rescue_matrix', JSON.stringify(feedback));
        showToast("AI Crisis Rescue Mode activated! Emergency tactics loaded.", "warn");
      } else {
        throw new Error("Invalid crisis tactical payload returned");
      }
    } catch (err) {
      console.error(err);
      showToast("Error processing Rescue tactical parsing.", "error");
    } finally {
      setRescueLoading(false);
    }
  };

  // --- AI INTERACTION - MICRO STEP BREAKDOWN ---
  const requestMicroStep = async (taskId: string) => {
    const task = appTasks.find(t => t.id === taskId);
    if (!task) return;

    showToast(`Generating high-effectiveness micro-step for inertia override...`, "success");

    const promptText = `
      System Instructions: Suggest a single extremely simplified 5-minute action step to break initial workflow inertia.
      Task content context properties: Title: "${task.title}". Snoozed Count: ${task.snoozeCount}.
      
      The result step should feel ridiculously uncomplicated or easy (e.g. Open up the editor document, search 1 reference, create title paragraph scaffold).
      Return strict JSON object with:
      {
        "microStep": "Highly actionable short step"
      }
    `;

    const schemaTemplate = {
      type: "OBJECT",
      properties: {
        microStep: { type: "STRING" }
      },
      required: ["microStep"]
    };

    try {
      const feedback = await fetchGeminiDirect(promptText, schemaTemplate);
      if (feedback && feedback.microStep) {
        const updated = appTasks.map(t => {
          if (t.id === taskId) {
            return { ...t, microStep: feedback.microStep, microStepCompleted: false };
          }
          return t;
        });
        setAppTasks(updated);
        localStorage.setItem('deadline_guardian_tasks', JSON.stringify(updated));
        showToast("Inertia bypass tactical action saved!", "success");
      } else {
        throw new Error("Invalid micro-step structure returned");
      }
    } catch (err) {
      console.error(err);
      showToast("Error processing micro-step parameters.", "error");
    }
  };

  // --- VIEW CALCULATIONS ---
  const activeCount = appTasks.filter(t => t.status === 'Pending').length;
  const completedCount = appTasks.filter(t => t.status === 'Completed').length;
  const overdueCount = appTasks.filter(t => t.status === 'Pending' && new Date(t.deadline) < new Date()).length;
  const highPriorityCount = appTasks.filter(t => t.status === 'Pending' && t.priority === 'High').length;
  const prodScore = calculateProductivityScore();

  // Primary task sorting for "Today's Critical Mission"
  const sortedPendingTasks = [...appTasks]
    .filter(t => t.status === 'Pending')
    .sort((a, b) => {
      const pMap = { High: 3, Medium: 2, Low: 1 };
      if (pMap[a.priority] !== pMap[b.priority]) {
        return pMap[b.priority] - pMap[a.priority];
      }
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  
  const primaryMission = sortedPendingTasks[0] || null;

  // Filter tasks list view
  const filteredTasks = [...appTasks].filter(t => {
    if (currentFilter === 'pending') return t.status === 'Pending';
    if (currentFilter === 'completed') return t.status === 'Completed';
    if (currentFilter === 'high') return t.priority === 'High';
    if (currentFilter === 'procrastination') return t.procrastinationRisk || t.snoozeCount > 2;
    return true; // 'all'
  });

  const getPrimaryMissionPrioBadgeClass = (prio: string) => {
    if (prio === 'High') return 'bg-emergencyRed/10 border-emergencyRed/35 text-emergencyRed';
    if (prio === 'Medium') return 'bg-warnOrange/10 border-warnOrange/35 text-warnOrange';
    return 'bg-successGreen/10 border-successGreen/35 text-successGreen';
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-obsidian text-[#fafafa] font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-[#0a0a0c] border-b md:border-b-0 md:border-r border-borderClr flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Branding */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-borderClr">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-sm font-bold text-white font-display tracking-tight">Ah</span>
            </div>
            <div className="text-left">
              <h1 className="font-display font-medium text-base tracking-tight text-white leading-none">Aheadly</h1>
              <span className="text-[9px] text-indigo-400 font-mono font-medium tracking-widest uppercase mt-1 block">Stay Ahead. Finish Smarter.</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            <button 
              id="nav-dashboard"
              onClick={() => setCurrentTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className="fa-solid fa-chart-line text-[14px] w-5 text-center"></i>
              <span>Dashboard</span>
            </button>

            <button 
              id="nav-tasks"
              onClick={() => setCurrentTab('tasks')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentTab === 'tasks'
                  ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className="fa-solid fa-list-check text-[14px] w-5 text-center"></i>
              <span>Tasks</span>
            </button>

            <button 
              id="nav-schedule"
              onClick={() => setCurrentTab('schedule')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentTab === 'schedule'
                  ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className="fa-solid fa-calendar-day text-[14px] w-5 text-center"></i>
              <span>Schedule</span>
            </button>

            <button 
              id="nav-rescue"
              onClick={() => setCurrentTab('rescue')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentTab === 'rescue'
                  ? 'bg-red-650/10 text-red-400 rounded-xl border border-red-500/20 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className="fa-solid fa-shield-halved text-[14px] w-5 text-center"></i>
              <span>Rescue Mode</span>
            </button>
          </nav>
        </div>

        {/* Footer & Settings */}
        <div className="p-4 border-t border-borderClr space-y-2">
          <button 
            onClick={() => {
              setSettingsOpsModeInput(opsMode);
              setSettingsKeyInput(geminiKey);
              setIsSettingsModalOpen(true);
            }} 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-all"
          >
            <i className="fa-solid fa-sliders text-sm"></i>
            <span>Settings</span>
          </button>
          <div className="px-4 py-1 text-[10px] text-gray-500 font-mono tracking-tight text-left select-none">
            Aheadly Productivity Platform © 2026
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top API Warning Notice Bar */}
        {(opsMode === 'demo' || !geminiKey) && (
          <header id="api-warning-bar" className="bg-amber-950/15 border-b border-warnOrange/25 px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-wand-magic-sparkles text-warnOrange text-xs animate-pulse"></i>
              <p className="text-xs text-amber-200 font-medium leading-relaxed text-left">Demo Mode Active — Intelligent features are simulated. Add your Gemini API key in Settings to unlock real-time intelligence.</p>
            </div>
            <button 
              onClick={() => {
                setSettingsOpsModeInput(opsMode);
                setSettingsKeyInput(geminiKey);
                setIsSettingsModalOpen(true);
              }} 
              className="text-xs bg-warnOrange/10 border border-warnOrange/30 text-warnOrange px-2.5 py-1 rounded-lg hover:bg-warnOrange/20 transition-all font-semibold shrink-0"
            >
              Configure API Key
            </button>
          </header>
        )}

        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-8">
          
          {/* ======================= 1. DASHBOARD VIEW ======================= */}
          {currentTab === 'dashboard' && (
            <section id="view-dashboard" className="space-y-6 animate-fade">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-left">
                  <h2 className="text-2xl font-display font-bold text-white tracking-tight">Aheadly Dashboard</h2>
                  <p className="text-xs text-gray-400 mt-1">Stay Ahead. Finish Smarter. Real-time priorities and smart simulations.</p>
                </div>
                <div className="text-xs font-mono text-gray-400 bg-cardBg/30 px-3.5 py-2 rounded-xl flex items-center gap-2 border border-borderClr select-none">
                  <i className="fa-solid fa-calendar text-guardPurple"></i>
                  <span>Perspective: 2026-06-23</span>
                </div>
              </div>

              {/* Prominent "Today's Mission" Hero Banner */}
              <div id="todays-mission-container" className="transition-all duration-300">
                {!primaryMission ? (
                  <div className="bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border border-purple-500/10 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-md">
                        <i className="fa-solid fa-circle-check text-lg"></i>
                      </div>
                      <div className="text-left">
                        <h4 className="text-sm font-semibold text-white">All Missions Fulfilled!</h4>
                        <p className="text-xs text-slate-400 mt-0.5">No pending items in your task vault. Enjoy the clean interface or log a new milestone!</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsAddTaskModalOpen(true)} 
                      className="bg-guardPurple hover:bg-guardPurpleHover text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-guardPurple/15 whitespace-nowrap cursor-pointer"
                    >
                      <i className="fa-solid fa-plus mr-1.5"></i>Log New Pillar
                    </button>
                  </div>
                ) : (
                  <div className="relative bg-gradient-to-r from-[#17122e]/55 to-cardBg/95 border border-purple-500/20 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 overflow-hidden shadow-xl">
                    <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-purple-600/10 blur-3xl pointer-events-none"></div>
                    
                    <div className="flex items-start md:items-center gap-4 min-w-0 flex-1 text-left">
                      <div className="w-12 h-12 rounded-xl bg-purple-600/15 flex items-center justify-center text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/5 mt-1 md:mt-0 shrink-0">
                        <i className="fa-solid fa-crosshairs text-lg animate-pulse text-purple-400"></i>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-purple-400">TODAY'S CRITICAL MISSION</span>
                          <span className={`px-2 py-0.5 border font-semibold text-[9px] font-mono rounded uppercase tracking-wide ${getPrimaryMissionPrioBadgeClass(primaryMission.priority)}`}>
                            {primaryMission.priority} urgent
                          </span>
                        </div>
                        <h4 className="text-base font-display font-bold text-white truncate leading-snug">{primaryMission.title}</h4>
                        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap leading-none">
                          <span className="flex items-center gap-1.5">
                            <i className="fa-regular fa-clock text-purple-400"></i>Est: <strong className="text-slate-200">{primaryMission.estTime} hrs</strong>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <i className="fa-regular fa-calendar-check text-purple-400"></i>Time Remaining: <span dangerouslySetInnerHTML={{ __html: formatDeadlinePretty(primaryMission.deadline) }} />
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 border-borderClr md:pt-0 pt-3.5">
                      <button 
                        onClick={() => handleTaskStatusToggle(primaryMission.id)} 
                        className="flex-1 md:flex-initial bg-successGreen/10 border border-successGreen/30 hover:bg-successGreen/20 text-successGreen text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-check text-[11px]"></i>
                        <span>Mark Done</span>
                      </button>
                      <button 
                        onClick={() => setCurrentTab('rescue')} 
                        className="flex-1 md:flex-initial bg-emergencyRed/10 border border-emergencyRed/30 hover:bg-emergencyRed/25 text-emergencyRed text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-triangle-exclamation text-[11px]"></i>
                        <span>Rescue AI</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* KPI Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-cardBg/60 border border-borderClr p-5 rounded-2xl relative overflow-hidden group select-none hover:border-zinc-800 hover:bg-cardBg/80 transition-all duration-300 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-zinc-400 font-mono tracking-wider uppercase">Active Tasks</p>
                      <h3 className="text-3xl font-display font-medium mt-2 text-white">{activeCount}</h3>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.02] border border-borderClr flex items-center justify-center text-zinc-400">
                      <i className="fa-solid fa-folder-tree text-sm"></i>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-3 font-mono">{activeCount} active, {completedCount} completed items</p>
                </div>

                <div 
                  id="stat-card-overdue" 
                  className={`bg-cardBg/60 border p-5 rounded-2xl relative overflow-hidden group select-none transition-all duration-300 hover:border-zinc-800 hover:bg-cardBg/80 text-left ${
                    overdueCount > 0 ? 'border-emergencyRed/50 bg-emergencyRed/5' : 'border-borderClr'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-zinc-400 font-mono tracking-wider uppercase">Overdue Tasks</p>
                      <h3 className="text-3xl font-display font-medium mt-2 text-white">{overdueCount}</h3>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.02] border border-borderClr flex items-center justify-center text-zinc-400">
                      <i className="fa-solid fa-clock-rotate-left text-sm"></i>
                    </div>
                  </div>
                  {overdueCount > 0 ? (
                    <p className="text-[11px] mt-3 font-mono text-emergencyRed font-bold leading-none select-none">Immediate active breaches detected!</p>
                  ) : (
                    <p className="text-[11px] text-zinc-500 mt-3 font-mono">Zero overdue failure streak</p>
                  )}
                </div>

                <div className="bg-cardBg/60 border border-borderClr p-5 rounded-2xl relative overflow-hidden group select-none hover:border-zinc-800 hover:bg-cardBg/80 transition-all duration-300 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-zinc-400 font-mono tracking-wider uppercase">High Priority</p>
                      <h3 className="text-3xl font-display font-medium mt-2 text-white">{highPriorityCount}</h3>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.02] border border-borderClr flex items-center justify-center text-zinc-400">
                      <i className="fa-solid fa-angle-up text-sm"></i>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-3 font-mono">{highPriorityCount} critical tasks pending focus</p>
                </div>

                <div className="bg-cardBg/60 border border-borderClr p-5 rounded-2xl relative overflow-hidden group select-none hover:border-zinc-800 hover:bg-cardBg/80 transition-all duration-300 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-zinc-400 font-mono tracking-wider uppercase">Productivity Score</p>
                      <h3 className="text-3xl font-display font-semibold mt-2 text-zinc-100">{prodScore}%</h3>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.02] border border-borderClr flex items-center justify-center text-zinc-400">
                      <i className="fa-solid fa-circle-nodes text-sm"></i>
                    </div>
                  </div>
                  <div className="mt-4 bg-zinc-800/40 h-1 w-full rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${getProductivityBarColor(prodScore)}`} 
                      style={{ width: `${prodScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Middle Row: "What if I procrastinate?" Simulator & Upcoming Deadlines */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Procrastination Simulator */}
                <div className="lg:col-span-7 bg-cardBg/60 border border-borderClr p-6 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-warnOrange/10 border border-warnOrange/30 flex items-center justify-center text-warnOrange shrink-0">
                        <i className="fa-solid fa-hourglass-half text-xs"></i>
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-sm text-white">"What if I postpone?" Simulator</h4>
                        <p className="text-[11px] text-gray-400 font-sans mt-1">Simulate outcome delays and deadline collisions before rescheduling.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Selector Inputs */}
                    <div className="sm:col-span-5 space-y-3.5 flex flex-col justify-center text-left">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Select Active Task</label>
                        <select 
                          value={simTaskId}
                          onChange={(e) => {
                            setSimTaskId(e.target.value);
                            setSimResult(null);
                          }}
                          className="w-full bg-[#0a0a0c] text-zinc-100 rounded-xl border border-borderClr p-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all font-sans select-none"
                        >
                          {appTasks.filter(t => t.status === 'Pending').length === 0 ? (
                            <option value="">No pending tasks</option>
                          ) : (
                            appTasks.filter(t => t.status === 'Pending').map(t => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))
                          )}
                        </select>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Postpone Duration</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[1, 2, 3].map(days => (
                            <button 
                              key={days}
                              onClick={() => calculateSnoozeImpact(days)} 
                              className={`py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                simDays === days
                                  ? 'bg-warnOrange/15 border-warnOrange text-warnOrange'
                                  : 'bg-[#0c0c0e]/80 border-borderClr text-slate-400 hover:text-white hover:border-warnOrange hover:bg-warnOrange/5'
                              }`}
                            >
                              +{days} {days === 1 ? 'Day' : 'Days'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Consequences Output display block */}
                    <div className="sm:col-span-7 bg-[#0a0a0c] p-4 rounded-xl border border-borderClr flex flex-col justify-center min-h-[145px]" id="procrastinate-output-container">
                      {!simLoading && !simResult && (
                        <div className="text-center py-4 space-y-2 select-none">
                          <i className="fa-solid fa-calculator text-zinc-500 text-lg"></i>
                          <p className="text-[10.5px] text-zinc-400 font-sans max-w-xs mx-auto leading-relaxed">Select an active task and delay duration on the left to simulate scheduling consequences.</p>
                        </div>
                      )}

                      {simLoading && (
                        <div className="text-center py-6 space-y-2 select-none">
                          <div className="w-6 h-6 rounded-full border-2 border-t-2 border-r-2 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
                          <p className="text-[10px] text-gray-400 font-mono">Simulating deadline consequences...</p>
                        </div>
                      )}

                      {!simLoading && simResult && (
                        <div className="space-y-3 font-sans text-left">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded border ${
                              simResult.riskFactor > 2.5
                                ? 'border-emergencyRed/45 bg-emergencyRed/10 text-emergencyRed animate-pulse'
                                : 'border-warnOrange/45 bg-warnOrange/10 text-warnOrange'
                            }`}>
                              {simResult.threatLevel}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
                              <span>Risk factor:</span>
                              <strong className={`${
                                simResult.riskFactor > 2.5 ? 'text-emergencyRed' : 'text-warnOrange'
                              } font-bold text-xs`}>
                                {simResult.riskFactor.toFixed(1)}x
                              </strong>
                            </div>
                          </div>
                          <h5 className="text-xs font-bold text-white">{simResult.headline}</h5>
                          <p className="text-[11px] text-zinc-350 leading-relaxed italic">"{simResult.critique}"</p>
                          <div className="space-y-1 mt-1 pb-1">
                            {simResult.bulletThreats.map((msg, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[10px] font-mono leading-relaxed text-slate-300">
                                <span className="text-emergencyRed shrink-0 mt-0.5">●</span>
                                <span>{msg}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upcoming List */}
                <div className="lg:col-span-5 bg-cardBg/60 border border-borderClr p-6 rounded-2xl flex flex-col justify-between">
                  <div className="space-y-4 text-left">
                    <h4 className="font-display font-medium text-sm text-white">Upcoming Deadlines</h4>
                    {sortedPendingTasks.slice(0, 3).length === 0 ? (
                      <div className="py-6 text-center space-y-2 select-none">
                        <i className="fa-solid fa-circle-check text-successGreen text-xl"></i>
                        <p className="text-xs text-gray-400">Perfect alignment. No impending tasks pending in queue!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sortedPendingTasks.slice(0, 3).map(task => (
                          <div key={task.id} className="flex items-center justify-between p-3.5 rounded-xl border border-borderClr bg-[#0f0f13]/40 hover:bg-[#0f0f13]/85 transition-all">
                            <div className="space-y-1.5 min-w-0 flex-1 pr-3 text-left">
                              <h5 className="text-xs font-semibold text-white truncate">{task.title}</h5>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 leading-none">
                                <span dangerouslySetInnerHTML={{ __html: formatDeadlinePretty(task.deadline) }} />
                              </div>
                            </div>
                            <span className={`text-[9px] font-mono font-bold uppercase rounded border px-2 py-0.5 tracking-wider shrink-0 ${
                              task.priority === 'High' ? 'border-emergencyRed/40 text-emergencyRed bg-emergencyRed/5' :
                              task.priority === 'Medium' ? 'border-warnOrange/40 text-warnOrange bg-warnOrange/5' :
                              'border-successGreen/40 text-successGreen bg-successGreen/5'
                            }`}>{task.priority}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-borderClr mt-4">
                    <button 
                      onClick={() => {
                        setCurrentTab('tasks');
                        setCurrentFilter('pending');
                      }} 
                      className="w-full bg-white/[0.02] hover:bg-white/[0.04] text-xs font-semibold py-2.5 rounded-xl border border-borderClr transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Manage All Tasks</span>
                      <i className="fa-solid fa-arrow-right text-[10px]"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Analytics Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Priority Distribution */}
                <div className="bg-cardBg/60 border border-borderClr p-5 rounded-2xl flex flex-col justify-between space-y-3.5 hover:border-zinc-800 transition-all duration-300 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-sans font-bold text-xs text-zinc-400 tracking-wider uppercase">Priority Distribution</h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Active tasks density</p>
                    </div>
                    <span className="text-[9px] text-[#818cf8] font-mono uppercase bg-[#818cf8]/5 border border-[#818cf8]/20 px-2 py-0.5 rounded select-none">Overview</span>
                  </div>
                  <div className="relative w-full h-44 flex items-center justify-center">
                    <canvas ref={priorityCanvasRef} id="priority-chart"></canvas>
                  </div>
                </div>

                {/* Completion Ratio */}
                <div className="bg-cardBg/60 border border-borderClr p-5 rounded-2xl flex flex-col justify-between space-y-3.5 hover:border-zinc-800 transition-all duration-300 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-sans font-bold text-xs text-zinc-400 tracking-wider uppercase">Completion Ratio</h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Assigned targets achieved</p>
                    </div>
                    <span className="text-[9px] text-[#818cf8] font-mono uppercase bg-[#818cf8]/5 border border-[#818cf8]/20 px-2 py-0.5 rounded select-none">Efficiency</span>
                  </div>
                  <div className="relative w-full h-44 flex items-center justify-center">
                    <canvas ref={doughnutCanvasRef} id="completion-doughnut-chart"></canvas>
                  </div>
                </div>

                {/* Weekly Trend */}
                <div className="bg-cardBg/60 border border-borderClr p-5 rounded-2xl flex flex-col justify-between space-y-3.5 hover:border-zinc-800 transition-all duration-300 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-sans font-bold text-xs text-zinc-400 tracking-wider uppercase">Weekly Trend</h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Productivity factor over 7 days</p>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-mono uppercase bg-emerald-950/15 border border-emerald-500/25 px-2 py-0.5 rounded select-none">Consistency</span>
                  </div>
                  <div className="relative w-full h-44 flex items-center justify-center">
                    <canvas ref={lineCanvasRef} id="weekly-trend-chart"></canvas>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ======================= 2. TASKS PAGE ======================= */}
          {currentTab === 'tasks' && (
            <section id="view-tasks" className="space-y-6 animate-fade">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-left">
                  <h2 className="text-2xl font-display font-bold text-white tracking-tight">Tasks & Priorities</h2>
                  <p className="text-xs text-gray-400 mt-1">Manage task statuses, view priority tiers, and analyze delivery risks.</p>
                </div>
                {/* Task Page Header Controls */}
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={triggerAIPrioritization} 
                    className="bg-guardPurple hover:bg-guardPurpleHover border border-white/5 text-[13px] font-medium text-white px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                    <span>Intelligent Sorting</span>
                  </button>
                  <button 
                    onClick={() => setIsAddTaskModalOpen(true)} 
                    className="bg-white/[0.04] hover:bg-white/[0.08] border border-borderClr text-[13px] font-medium text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-xs"></i>
                    <span>New Task</span>
                  </button>
                </div>
              </div>

              {/* Controls Subbar: Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderClr/40 pb-3">
                <div className="flex flex-wrap gap-1.5" id="task-filter-tabs">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'pending', label: 'Pending' },
                    { id: 'completed', label: 'Completed' },
                    { id: 'high', label: 'High Priority' },
                    { id: 'procrastination', label: 'Attention Required' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setCurrentFilter(tab.id)} 
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        currentFilter === tab.id
                          ? 'bg-guardPurple text-white'
                          : 'bg-white/5 border border-borderClr text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Tasks Table */}
              <div className="overflow-hidden rounded-2xl border border-borderClr bg-cardBg/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-white/[0.01] border-b border-borderClr text-zinc-400 font-mono text-[10px] uppercase tracking-wider select-none">
                        <th className="py-3.5 px-5 w-12 text-center">Status</th>
                        <th className="py-3.5 px-4 font-semibold">Task Details</th>
                        <th className="py-3.5 px-4 font-semibold">Due Date</th>
                        <th className="py-3.5 px-4 font-semibold">Priority</th>
                        <th className="py-3.5 px-4 font-semibold">Est. Time</th>
                        <th className="py-3.5 px-5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="task-table-body" className="divide-y divide-borderClr/45">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-16 text-gray-500 text-xs font-mono select-none">
                            <i className="fa-solid fa-square-minus text-2xl text-violet-400 mb-2 block text-center"></i>
                            No records matching directory conditions
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map(task => {
                          const isCompleted = task.status === 'Completed';
                          const isRisk = task.snoozeCount > 2 || task.procrastinationRisk;

                          return (
                            <tr key={task.id} className={`${isCompleted ? 'opacity-55' : ''} hover:bg-white/[0.015] transition-colors text-xs font-sans`}>
                              {/* Completed tick field */}
                              <td className="py-4 px-5 text-center leading-none">
                                <button 
                                  onClick={() => handleTaskStatusToggle(task.id)} 
                                  className={`w-5 h-5 rounded border border-borderClr flex items-center justify-center text-[10px] cursor-pointer ${
                                    isCompleted 
                                      ? 'bg-guardPurple text-white border-guardPurple' 
                                      : 'bg-obsidian hover:border-guardPurple transition-all'
                                  }`}
                                >
                                  {isCompleted && <i className="fa-solid fa-check"></i>}
                                </button>
                              </td>
                              {/* Custom title spec */}
                              <td className="py-4 px-4 pr-6 min-w-[210px] space-y-2 text-left">
                                <div className="flex items-center gap-2">
                                  <span className={`font-semibold text-white ${isCompleted ? 'line-through text-gray-500' : ''}`}>{task.title}</span>
                                  {isRisk && (
                                    <span className="text-[9px] font-mono leading-none font-black text-warnOrange bg-warnOrange/10 border border-warnOrange/35 px-1.5 py-0.5 rounded uppercase tracking-wide animate-pulse">
                                      ⚠️ Risk
                                    </span>
                                  )}
                                </div>
                                
                                {/* AI Prioritizing explanation */}
                                {task.aiReason && (
                                  <p className="text-[10px] text-gray-400 font-sans leading-relaxed flex items-start gap-1 p-2 rounded bg-white/[0.015] border border-borderClr/65">
                                    <i className="fa-solid fa-brain-circuit text-[9px] text-guardPurple shrink-0 mt-0.5"></i>
                                    <span>{task.aiReason}</span>
                                  </p>
                                )}
                                
                                {/* Micro Step suggesting area (Procrastination Loop) */}
                                {isRisk && !isCompleted && (
                                  <div className="mt-2.5 p-3 rounded-lg border bg-amber-950/15 border-warnOrange/25 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-200">5-Min Inertia Micro-Step:</span>
                                      {!task.microStep && (
                                        <button 
                                          onClick={() => requestMicroStep(task.id)} 
                                          className="text-[10px] rounded bg-warnOrange text-obsidian px-2 py-0.5 font-bold hover:bg-yellow-400 transition-colors uppercase font-mono ring-1 ring-white/10 shrink-0 cursor-pointer"
                                        >
                                          ⚡ Break Down inertia
                                        </button>
                                      )}
                                    </div>
                                    
                                    {task.microStep && (
                                      <div className="flex items-start gap-2.5">
                                        <button 
                                          onClick={() => handleMicroStepToggle(task.id)} 
                                          className={`w-4.5 h-4.5 rounded border border-warnOrange/40 flex items-center justify-center text-[8px] bg-obsidian shrink-0 mt-0.5 cursor-pointer ${
                                            task.microStepCompleted ? 'bg-amber-500 text-obsidian border-amber-500' : ''
                                          }`}
                                        >
                                          {task.microStepCompleted && <i className="fa-solid fa-check"></i>}
                                        </button>
                                        <span className={`text-[11px] font-medium leading-relaxed font-sans ${task.microStepCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                          {task.microStep}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              {/* Target Deadline pretty formatted */}
                              <td className="py-4 px-4 font-mono select-none text-left">
                                <span dangerouslySetInnerHTML={{ __html: formatDeadlinePretty(task.deadline) }} />
                              </td>
                              {/* Priority tag styling */}
                              <td className="py-4 px-4 font-mono text-left">
                                <span className={`px-2 py-0.5 border font-semibold rounded text-[10px] uppercase leading-none tracking-wide ${
                                  task.priority === 'High' ? 'bg-emergencyRed/5 border-emergencyRed/35 text-emergencyRed' :
                                  task.priority === 'Medium' ? 'bg-warnOrange/5 border-warnOrange/35 text-warnOrange' :
                                  'bg-successGreen/5 border-successGreen/35 text-successGreen'
                                }`}>{task.priority}</span>
                              </td>
                              {/* Estimated units */}
                              <td className="py-4 px-4 font-mono font-medium text-gray-300 text-left">{task.estTime} hr{task.estTime > 1 ? 's' : ''}</td>
                              {/* Task Row Action buttons */}
                              <td className="py-4 px-5 text-right space-x-1 whitespace-nowrap">
                                {!isCompleted && (
                                  <button 
                                    onClick={() => handleTaskSnooze(task.id)} 
                                    className="p-1 px-2.5 rounded bg-white/5 border border-borderClr/65 text-gray-300 hover:text-white hover:bg-white/10 hover:border-gray-500 transition-all text-[11px] font-semibold inline-flex items-center gap-1.5 leading-none cursor-pointer"
                                  >
                                    <i className="fa-regular fa-clock"></i>
                                    <span>Snooze ({task.snoozeCount})</span>
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleTaskDelete(task.id)} 
                                  className="p-1.5 px-2.5 rounded bg-emergencyRed/10 border border-emergencyRed/35 text-emergencyRed hover:text-white hover:bg-emergencyRed/80 hover:border-emergencyRed transition-all text-xs cursor-pointer"
                                >
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ======================= 3. SCHEDULE PAGE ======================= */}
          {currentTab === 'schedule' && (
            <section id="view-schedule" className="space-y-6 animate-fade">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-left">
                  <h2 className="text-2xl font-display font-bold text-white tracking-tight">Daily Schedule</h2>
                  <p className="text-xs text-gray-400 mt-1">Smart, hourly schedule blocks sequence generated for you tomorrow starting at 8:00 AM.</p>
                </div>
                <button 
                  onClick={generateAISchedule} 
                  className="bg-guardPurple hover:bg-guardPurpleHover border border-white/5 text-[13px] font-medium text-white px-5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer animate-fade"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                  <span>Generate Schedule</span>
                </button>
              </div>

              {/* Schedule Container */}
              <div className="bg-cardBg/60 border border-borderClr rounded-2xl p-6 md:p-8 space-y-6">
                {scheduleLoading && (
                  <div className="py-16 flex flex-col items-center justify-center space-y-3.5 text-center select-none">
                    <div className="w-10 h-10 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Consulting Aheadly AI...</p>
                      <p className="text-[11px] text-gray-500 font-mono mt-1">Synthesizing routine blocks...</p>
                    </div>
                  </div>
                )}

                {!scheduleLoading && activeSchedule.length === 0 && (
                  <div className="py-16 text-center max-w-sm mx-auto space-y-4 select-none">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-borderClr flex items-center justify-center text-gray-400 mx-auto">
                      <i className="fa-solid fa-calendar-day text-lg text-indigo-400"></i>
                    </div>
                    <div>
                      <h3 className="font-display font-medium text-white">No active schedule</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">Let Aheadly sequence your tasks into a workable hour-by-hour timeline schema.</p>
                    </div>
                  </div>
                )}

                {!scheduleLoading && activeSchedule.length > 0 && (
                  <div id="schedule-timeline" className="relative pl-6 sm:pl-8 border-l border-zinc-800 space-y-5 text-left">
                    {activeSchedule.map((block, i) => (
                      <div key={i} className="relative animate-fade" style={{ animationDelay: `${i * 45}ms` }}>
                        {/* Bullet marker left side */}
                        <span className="absolute -left-[35px] top-1.5 bg-obsidian border-2 border-guardPurple w-4 h-4 rounded-full flex items-center justify-center z-10"></span>
                        
                        <div className="bg-obsidian/45 border border-borderClr p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-guardPurple/40 transition-all font-sans">
                          <div className="space-y-1">
                            <span className="font-mono text-xs font-bold text-guardPurple tracking-widest">{block.time}</span>
                            <h4 className="text-sm font-semibold text-white leading-tight">{block.action}</h4>
                          </div>
                          <span className="text-[10px] uppercase font-mono font-bold text-gray-400 bg-white/5 border border-borderClr px-2.5 py-1 rounded-lg shrink-0 w-max leading-none">
                            <i className="fa-regular fa-clock text-guardPurple mr-1.5"></i>{block.duration}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ======================= 4. AI RESCUE HUB ======================= */}
          {currentTab === 'rescue' && (
            <section id="view-rescue" className="space-y-6 animate-fade">
              <div className="space-y-1 text-left">
                <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2.5 tracking-tight">
                  <i className="fa-solid fa-shield-halved text-indigo-400"></i>
                  <span>Rescue Mode</span>
                </h2>
                <p className="text-xs text-zinc-400">Overcoming time constraints and task overload with adaptive planning during urgent windows.</p>
              </div>

              {/* Crisis Input State Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Panic Input Console */}
                <div className="lg:col-span-5 bg-cardBg/60 border border-borderClr p-6 rounded-2xl flex flex-col justify-between space-y-6">
                  <div className="space-y-4 text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <i className="fa-solid fa-bolt text-sm"></i>
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-white">Calculate Action Plan</h3>
                        <p className="text-[11px] text-gray-400 font-sans mt-0.5">Let Aheadly draft an emergency timeline.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Describe your current situation:</label>
                      <textarea 
                        value={crisisDescription}
                        onChange={(e) => setCrisisDescription(e.target.value)}
                        placeholder="e.g. My presentation is tomorrow morning, but my slides are incomplete and I still need to verify the code base. I have an examination starting tomorrow afternoon and feel extremely overwhelmed with no clear starting point." 
                        className="w-full bg-[#0a0a0c] text-slate-100 placeholder-zinc-700 rounded-xl border border-borderClr p-3 text-xs focus:outline-none focus:border-indigo-500/80 transition-all font-sans h-44 resize-none leading-relaxed"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Or Select a Crisis Test Case:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "📚 Exam Prep", text: "I have an exam tomorrow and I haven't studied." },
                          { label: "🌍 Warming Slide", text: "I have a class presentation on global warming tomorrow at 8 AM." },
                          { label: "💻 Bug Hotfix", text: "I have a production deployment bug to fix tonight before our release tomorrow at 9 AM." },
                          { label: "📊 Blank Report", text: "I have a 10-page market research report due to my supervisor in 6 hours, and I only have a blank document." },
                          { label: "🤝 Job Interview", text: "I have an intense technical job interview tomorrow morning and need to study system architecture patterns." }
                        ].map((testCase, idx) => (
                          <button
                            key={idx}
                            id={`test-case-${idx}`}
                            onClick={() => {
                              setCrisisDescription(testCase.text);
                              showToast(`Loaded test template: "${testCase.label}"`, 'success');
                            }}
                            className="text-[10px] bg-white/[0.02] border border-borderClr text-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all cursor-pointer font-sans"
                          >
                            {testCase.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-borderClr">
                    <button 
                      onClick={triggerRescueWorkflow} 
                      className="w-full bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg text-xs font-semibold text-white py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5 shrink-0 cursor-pointer"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                      <span>GENERATE RESCUE PROGRAM</span>
                    </button>
                  </div>
                </div>

                {/* Urgent Dashboard display block */}
                <div className="lg:col-span-7 bg-cardBg/60 border border-borderClr p-6 rounded-2xl flex flex-col min-h-[380px]">
                  {rescueLoading && (
                    <div className="my-auto py-12 flex flex-col items-center justify-center space-y-4 text-center select-none">
                      <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-350">Calculating focus stacks...</h4>
                        <p className="text-[11px] text-gray-500 font-mono mt-1">Re-ordering tasks, ranking postponed options, establishing first step...</p>
                      </div>
                    </div>
                  )}

                  {!rescueLoading && !rescueMatrix && (
                    <div className="my-auto py-12 text-center max-w-sm mx-auto space-y-4 select-none">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-borderClr flex items-center justify-center text-gray-400 mx-auto">
                        <i className="fa-solid fa-life-ring text-lg text-indigo-400"></i>
                      </div>
                      <div>
                        <h3 className="font-display font-medium text-white">Rescue plan pending</h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">Specify what's causing overwhelm on the left, and let Aheadly build an absolute emergency focus protocol for you immediately.</p>
                      </div>
                    </div>
                  )}

                  {/* Activated State: Emergency Dashboard */}
                  {!rescueLoading && rescueMatrix && (
                    <div className="space-y-6">
                      {/* Animated emergency alert banner */}
                      <div className="bg-red-950/20 border border-emergencyRed/45 text-emergencyRed rounded-xl p-3 flex items-center justify-between text-xs overflow-hidden relative select-none">
                        <div className="absolute inset-0 bg-emergencyRed/5"></div>
                        <div className="flex items-center gap-2.5 z-10 font-bold tracking-wider uppercase font-mono">
                          <span>⚠️ RESCUE MODE ACTIVE: WORKSPACE PRIORITY TUNED</span>
                        </div>
                        <span className="text-[9px] font-mono text-rose-300 border border-emergencyRed/40 bg-emergencyRed/20 px-2 py-0.5 rounded-md z-10 shrink-0">CRISIS ACTION PLAN</span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-borderClr pb-4">
                        <div className="text-left">
                          <span className="text-[10px] font-mono uppercase bg-emergencyRed/10 border border-emergencyRed/30 px-2.5 py-0.5 rounded text-emergencyRed font-bold tracking-wider">RESCUE LEVEL ACTION PLAN</span>
                          <h3 className="text-md font-display font-bold text-rose-100 mt-2">Action Plan</h3>
                        </div>
                        {/* Success Dial Gauge */}
                        <div className="flex items-center gap-4 bg-[#14141d] px-4 py-3 border border-borderClr rounded-xl shrink-0 select-none">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                              <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              <path 
                                className="text-emerald-400 transition-all duration-1000" 
                                strokeWidth="3.5" 
                                strokeLinecap="round" 
                                strokeDasharray={`${rescueMatrix.estimatedSuccessProbability}, 100`} 
                                stroke="currentColor" 
                                fill="none" 
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                              />
                            </svg>
                            <span className="text-[11px] font-mono font-black text-emerald-400 z-10">{rescueMatrix.estimatedSuccessProbability}%</span>
                          </div>
                          <div className="text-left">
                            <p className="text-[9px] font-mono text-gray-400 uppercase leading-none">Survival Odds</p>
                            <span className={`text-[10px] font-mono mt-1.5 block font-bold uppercase ${
                              rescueMatrix.estimatedSuccessProbability > 80 ? 'text-emerald-400' :
                              rescueMatrix.estimatedSuccessProbability > 45 ? 'text-warnOrange animate-pulse' :
                              'text-emergencyRed animate-pulse'
                            }`}>
                              {rescueMatrix.estimatedSuccessProbability > 80 ? 'SECURE PARADIGM' :
                               rescueMatrix.estimatedSuccessProbability > 45 ? 'HIGH RISK WARNING' :
                               'CRUCIAL BREACH CHANCE'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 5-Minute Inertia Breaker Hero Banner */}
                      <div className="bg-gradient-to-r from-emerald-950/20 to-teal-950/20 border border-emerald-500/25 p-4 rounded-xl space-y-2 text-left">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-[9px] font-mono font-black uppercase text-emerald-300 tracking-widest">IMMEDIATE COGNITIVE BREAKER (FIRST 5 MINUTES)</span>
                        </div>
                        <h4 className="text-xs font-bold text-white leading-relaxed p-0.5">
                          <i className="fa-solid fa-person-running mr-2 text-emerald-400"></i>
                          {rescueMatrix.quickstartAction}
                        </h4>
                        <p className="text-[9px] text-emerald-200/70 font-mono">Initiate work on this right away with zero stress about the grand final version. Just complete 1 skeletal block.</p>
                      </div>

                      {/* Triage quadrants */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Urgent priority stack */}
                        <div className="bg-obsidian border border-emergencyRed/20 p-4 rounded-xl space-y-3 text-left">
                          <h4 className="text-xs font-semibold text-rose-100 flex items-center gap-2">
                            <i className="fa-solid fa-mars-double text-emergencyRed text-xs"></i>
                            <span>Critical Priority Stack</span>
                          </h4>
                          <p className="text-[9px] font-mono text-gray-400">Accelerated step-by-step sequential requirements.</p>
                          <ul className="space-y-2 text-xs">
                            {rescueMatrix.reprioritizedTaskList.map((item, i) => (
                              <li key={i} className="space-y-1">
                                <div className="flex items-start gap-2">
                                  <span className="text-emergencyRed text-[9px] font-mono leading-none bg-emergencyRed/10 border border-emergencyRed/30 px-1 py-0.5 rounded shrink-0 mt-0.5 font-bold">TACTIC {i+1}</span>
                                  <span className="font-bold text-white leading-tight">{item.title}</span>
                                </div>
                                <p className="text-slate-400 pl-9 text-[11px] leading-relaxed">{item.reason}</p>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Strategic Postponements */}
                        <div className="bg-obsidian border border-borderClr p-4 rounded-xl space-y-3 text-left">
                          <h4 className="text-xs font-semibold text-amber-200 flex items-center gap-2">
                            <i className="fa-solid fa-clock-rotate-left text-warnOrange text-xs"></i>
                            <span>Strategic Postponements</span>
                          </h4>
                          <p className="text-[9px] font-mono text-gray-400">Deferred target components to reduce scheduling noise.</p>
                          <ul className="space-y-2 text-xs">
                            {rescueMatrix.tasksToPostpone.length === 0 ? (
                              <li className="text-gray-500 font-mono text-[10px] py-2 text-center">No postponements recommended.</li>
                            ) : (
                              rescueMatrix.tasksToPostpone.map((item, i) => (
                                <li key={i} className="space-y-1 bg-white/[0.015] border border-borderClr/60 p-2.5 rounded-xl">
                                  <span className="text-amber-200 font-bold flex items-center gap-1.5 font-sans">
                                    <i className="fa-solid fa-circle-pause text-[10px] text-amber-500"></i>
                                    {item.title}
                                  </span>
                                  <p className="text-slate-400 text-[11px] pl-4.5 leading-relaxed mt-0.5">{item.postponeReason}</p>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>

                        {/* Tasks to Abandon */}
                        <div className="bg-red-950/10 border border-emergencyRed/25 p-4 rounded-xl space-y-3 text-left">
                          <h4 className="text-xs font-semibold text-red-300 flex items-center gap-2">
                            <i className="fa-solid fa-scissors text-red-400 text-[11px]"></i>
                            <span>Unproductive Targets Dropped</span>
                          </h4>
                          <p className="text-[9px] font-mono text-red-400/75">Immediately eliminate. Low ROI outputs with negligible impacts.</p>
                          <ul className="space-y-2 text-xs">
                            {rescueMatrix.tasksToAbandon.length === 0 ? (
                              <li className="flex items-center gap-2 p-2.5 text-slate-400 border border-white/5 bg-white/[0.01] rounded-xl">
                                <i className="fa-solid fa-circle-check text-emerald-400 shrink-0 text-xs"></i>
                                <span className="font-mono text-[10px]">Zero abandon candidates found. Keep focus integrity.</span>
                              </li>
                            ) : (
                              rescueMatrix.tasksToAbandon.map((item, i) => (
                                <li key={i} className="space-y-1 bg-[#1a0a0d]/40 border border-emergencyRed/15 p-2.5 rounded-xl text-left">
                                  <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-ban text-emergencyRed text-[10px]"></i>
                                    <span className="text-slate-300 font-bold line-through">{item.title}</span>
                                    <span className="text-[8px] font-mono uppercase bg-emergencyRed/20 text-red-200 border border-emergencyRed/45 px-1 rounded font-black shrink-0">DROP</span>
                                  </div>
                                  <p className="text-slate-400 text-[11px] pl-4.5 leading-relaxed italic mt-0.5">{item.abandonReason}</p>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>

                        {/* Crisis timeline progression */}
                        <div className="bg-obsidian border border-purple-500/10 p-4 rounded-xl space-y-3 text-left">
                          <h4 className="text-xs font-semibold text-[#c0a9ff] flex items-center gap-2">
                            <i className="fa-solid fa-timeline text-purple-400 text-xs"></i>
                            <span>Crisis Timeline Countdown</span>
                          </h4>
                          <p className="text-[9px] font-mono text-slate-400">Countdown checkpoints to secure compliance.</p>
                          <div className="relative border-l border-borderClr pl-4 ml-1.5 pt-1 space-y-3">
                            {rescueMatrix.emergencyTimeline.map((milestone, i) => (
                              <div key={i} className="relative animate-fade text-left pl-1">
                                <span className="absolute -left-[20.5px] top-1 bg-obsidian border-2 border-purple-500 w-3 h-3 rounded-full z-10"></span>
                                <div className="flex items-start justify-between gap-2.5 bg-white/[0.015] border border-borderClr p-2.5 rounded-xl font-sans">
                                  <div className="space-y-0.5 min-w-0 pr-2">
                                    <span className="font-mono text-[10px] font-bold text-purple-400 tracking-wider">{milestone.time}</span>
                                    <p className="text-[11px] text-slate-200 leading-snug">{milestone.action}</p>
                                  </div>
                                  <span className={`text-[8px] font-mono font-bold uppercase rounded border px-1.5 py-0.5 shrink-0 ${
                                    milestone.risk === 'High' ? 'border-emergencyRed/35 text-red-400 bg-emergencyRed/5 animate-pulse' :
                                    milestone.risk === 'Medium' ? 'border-warnOrange/35 text-warnOrange bg-warnOrange/5' :
                                    'border-successGreen/35 text-emerald-400 bg-successGreen/5'
                                  }`}>{milestone.risk} risk</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      {/* ======================== 5. MODAL: SYSTEM SETTINGS ======================== */}
      {isSettingsModalOpen && (
        <div id="modal-settings" className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cardBg border border-borderClr max-w-md w-full rounded-2xl shadow-2xl p-6 space-y-5 animate-fade max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-borderClr pb-3">
              <h3 className="font-display font-medium text-base text-white flex items-center gap-2">
                <i className="fa-solid fa-gear text-indigo-400"></i>
                <span>Settings</span>
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <div className="space-y-4">
              {/* API Mode Select */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest block">AI Operations Mode</label>
                <select 
                  value={settingsOpsModeInput} 
                  onChange={(e) => setSettingsOpsModeInput(e.target.value)}
                  className="w-full bg-[#0a0a0c] text-slate-100 rounded-xl border border-borderClr p-2.5 text-xs focus:outline-none focus:border-indigo-500 font-sans select-none"
                >
                  <option value="demo">Demo Client Mode (AIP Offline Simulator)</option>
                  <option value="api">Active Direct Gemini API Mode</option>
                </select>
                <p className="text-[10px] text-zinc-400 font-sans leading-relaxed mt-1">
                  {settingsOpsModeInput === 'api' 
                    ? "Connects directly via secure HTTPS calls to Gemini Flash engines with the API key below validation."
                    : "Offline Simulated Mode runs instant high-fidelity priority mappings and timeline estimates locally without external queries."}
                </p>
              </div>

              {/* API Field */}
              {settingsOpsModeInput === 'api' && (
                <div id="settings-key-container" className="space-y-1.5 text-left animate-fade">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest block">Gemini API Token Key</label>
                    <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 hover:underline font-semibold flex items-center gap-1">
                      <span>Get Key free</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                    </a>
                  </div>
                  <input 
                    type="password" 
                    value={settingsKeyInput}
                    onChange={(e) => setSettingsKeyInput(e.target.value)}
                    placeholder="AIzaSy..." 
                    className="w-full bg-[#0a0a0c] text-white placeholder-zinc-700 rounded-xl border border-borderClr p-2.5 text-xs focus:outline-none focus:border-indigo-500 font-mono" 
                  />
                  <p className="text-[10px] text-zinc-500 font-sans leading-relaxed mt-1">
                    Key is saved securely directly inside your browser cache. Secure end-to-end client connection is used to query <strong>gemini-2.0-flash</strong>.
                  </p>
                </div>
              )}

              {/* Storage Controls */}
              <div className="space-y-2 pt-2 border-t border-borderClr text-left">
                <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest block">LocalStorage Cache Control</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button onClick={handleResetToDemoData} className="bg-white/[0.02] hover:bg-white/[0.06] text-[10px] border border-borderClr text-gray-300 font-semibold py-2.5 rounded-xl transition-all cursor-pointer">
                    Reset Demo Data
                  </button>
                  <button onClick={handleClearAppCache} className="bg-red-950/10 hover:bg-red-950/25 hover:border-emergencyRed/45 text-[10px] border border-emergencyRed/30 text-rose-300 font-semibold py-2.5 rounded-xl transition-all cursor-pointer">
                    Wipe localStorage
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-borderClr flex gap-3">
              <button onClick={() => setIsSettingsModalOpen(false)} className="flex-1 bg-white/[0.02] hover:bg-white/[0.05] border border-borderClr text-xs font-semibold py-2.5 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSaveSettings} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white py-2.5 rounded-xl transition-all cursor-pointer">
                Save Adjustments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== 6. MODAL: ADD TASK ======================== */}
      {isAddTaskModalOpen && (
        <div id="modal-add-task" className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddTaskSubmit} className="bg-cardBg border border-borderClr max-w-sm w-full rounded-2xl shadow-2xl p-6 space-y-4 animate-fade">
            <div className="flex items-center justify-between border-b border-borderClr pb-3">
              <h3 className="font-display font-medium text-base text-white">Create New Task</h3>
              <button type="button" onClick={() => setIsAddTaskModalOpen(false)} className="text-gray-400 hover:text-white transition-colors text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Task Title</label>
                <input 
                  type="text" 
                  value={addTaskTitle}
                  onChange={(e) => setAddTaskTitle(e.target.value)}
                  required 
                  placeholder="e.g. Design app dashboard interface" 
                  className="w-full bg-[#0a0a0c] text-slate-100 placeholder-zinc-700 rounded-xl border border-borderClr p-2.5 text-xs focus:outline-none focus:border-indigo-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Deadline Target</label>
                  <input 
                    type="datetime-local" 
                    value={addTaskDeadline}
                    onChange={(e) => setAddTaskDeadline(e.target.value)}
                    required 
                    className="w-full bg-[#0a0a0c] text-white rounded-xl border border-borderClr p-2.5 text-xs focus:outline-none focus:border-indigo-500 uppercase font-mono" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Est. Time (Hours)</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    min="0.5" 
                    value={addTaskEstTime}
                    onChange={(e) => setAddTaskEstTime(e.target.value)}
                    required 
                    placeholder="e.g. 2.5" 
                    className="w-full bg-[#0a0a0c] text-slate-100 placeholder-zinc-700 rounded-xl border border-borderClr p-2.5 text-xs focus:outline-none focus:border-indigo-500" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Initial Priority Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Low', 'Medium', 'High'] as const).map(p => {
                    const isSelected = addedPrioSelected === p;
                    let selectedClass = "bg-obsidian border-borderClr text-gray-400 hover:border-gray-500";
                    if (isSelected) {
                      if (p === 'High') selectedClass = "bg-emergencyRed/10 border-emergencyRed text-emergencyRed hover:bg-emergencyRed/20";
                      else if (p === 'Medium') selectedClass = "bg-warnOrange/10 border-warnOrange text-warnOrange hover:bg-warnOrange/20";
                      else selectedClass = "bg-successGreen/10 border-successGreen text-successGreen hover:bg-successGreen/20";
                    }

                    return (
                      <button 
                        key={p}
                        type="button" 
                        onClick={() => setAddedPrioSelected(p)} 
                        className={`font-semibold py-2 rounded-lg text-xs border transition-all cursor-pointer ${selectedClass}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-borderClr flex gap-3">
              <button type="button" onClick={() => setIsAddTaskModalOpen(false)} className="flex-1 bg-white/[0.02] hover:bg-white/[0.05] border border-borderClr text-xs font-semibold py-2.5 rounded-xl text-zinc-400 transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-all cursor-pointer">
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unified Toast Overlay Notification Container */}
      <div id="toast-container" className="fixed bottom-6 right-6 z-55 space-y-2.5 pointer-events-none max-w-sm w-full">
        {toasts.map(toast => {
          const icon = toast.type === 'success' ? 'fa-circle-check' : toast.type === 'error' ? 'fa-triangle-exclamation' : 'fa-bell';
          const color = toast.type === 'success' ? 'text-successGreen' : toast.type === 'error' ? 'text-emergencyRed' : 'text-warnOrange';
          const bgBorder = toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200' :
                           toast.type === 'error' ? 'bg-red-950/80 border-emergencyRed text-rose-100 animate-pulse' :
                           'bg-amber-950/85 border-warnOrange text-amber-250';

          return (
            <div 
              key={toast.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transform transition-all duration-300 text-xs font-semibold pointer-events-auto ${bgBorder}`}
            >
              <i className={`fa-solid ${icon} ${color} text-sm`}></i>
              <div className="flex-1 text-left">{toast.message}</div>
              <button 
                className="text-white/40 hover:text-white/85 text-sm transition-colors cursor-pointer ml-1" 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
