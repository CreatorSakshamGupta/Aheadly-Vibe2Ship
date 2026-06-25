import { Task, ProcrastinationResult, ScheduleBlock, RescueMatrix } from './types';

// Default tasks generator using dynamic dates relative to current load time
export function getDemoTasksDefault(): Task[] {
  const now = new Date();
  
  const today4PM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0);
  if (today4PM < now) {
    today4PM.setTime(now.getTime() + 5 * 3600 * 1000); // offset if passed
  }
  
  const tomorrow1159PM = new Date(now.getTime() + 24 * 3600 * 1000);
  tomorrow1159PM.setHours(23, 59, 0, 0);
  
  const in3Days = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
  in3Days.setHours(12, 0, 0, 0);
  
  const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  in7Days.setHours(17, 0, 0, 0);

  return [
    {
      id: "task_1",
      title: "Final Year Project Submission",
      deadline: tomorrow1159PM.toISOString().slice(0, 16),
      priority: "High",
      estTime: 5,
      status: "Pending",
      snoozeCount: 0,
      procrastinationRisk: false,
      microStep: null,
      microStepCompleted: false,
      aiReason: "Large deliverable with heavy academic impact. Breaking down is highly recommended."
    },
    {
      id: "task_2",
      title: "Read Research Paper",
      deadline: in3Days.toISOString().slice(0, 16),
      priority: "Medium",
      estTime: 2,
      status: "Pending",
      snoozeCount: 0,
      procrastinationRisk: false,
      microStep: null,
      microStepCompleted: false,
      aiReason: "Good prep task. Medium urgency, allows block cognitive intervals."
    },
    {
      id: "task_3",
      title: "Team Meeting Presentation",
      deadline: today4PM.toISOString().slice(0, 16),
      priority: "High",
      estTime: 1,
      status: "Pending",
      snoozeCount: 0,
      procrastinationRisk: false,
      microStep: null,
      microStepCompleted: false,
      aiReason: "Imminent deadline. Action required immediately to avoid presentation failure."
    },
    {
      id: "task_4",
      title: "Update Resume",
      deadline: in7Days.toISOString().slice(0, 16),
      priority: "Low",
      estTime: 1.5,
      status: "Pending",
      snoozeCount: 0,
      procrastinationRisk: false,
      microStep: null,
      microStepCompleted: false,
      aiReason: "Low urgency but high long-term career returns. Suitable for reserve focus slots."
    }
  ];
}

// Pretty formatted deadlines relative to current date
export function formatDeadlinePretty(deadlineStr: string): string {
  const d = new Date(deadlineStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const isOverdue = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);
  
  const diffMins = Math.floor(absDiffMs / (60 * 1000));
  const diffHours = Math.floor(absDiffMs / (3600 * 1000));
  const diffDays = Math.floor(absDiffMs / (24 * 3600 * 1000));
  
  if (isOverdue) {
    if (diffMins < 60) return `Overdue by ${diffMins}m`;
    if (diffHours < 24) return `Overdue by ${diffHours}h`;
    return `Overdue by ${diffDays}d`;
  } else {
    if (diffMins < 60) return `In ${diffMins} mins`;
    if (diffHours < 24) {
      if (d.getDate() === now.getDate()) {
        return `Today at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      }
      return `In ${diffHours} hours`;
    }
    if (diffDays === 1) {
      return `Tomorrow at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    return `In ${diffDays} days (${d.toLocaleDateString([], {month: 'short', day: 'numeric'})})`;
  }
}

// High-fidelity offline procrastination simulation
export function simulateProcrastination(task: Task, days: number): ProcrastinationResult {
  let baseFactor = 1.0;
  let level = "SENSITIVE IMPACT";
  let headline = "Timeline Expansion Detected";
  let bullets: string[] = [];
  let critiqueText = "";

  if (task.priority === 'High') {
    baseFactor = 1.8;
    level = days >= 2 ? "CRITICAL SHOCK" : "MODERATE RISK";
  } else {
    baseFactor = 1.1;
    level = days >= 3 ? "MODERATE RISK" : "SENSITIVE IMPACT";
  }

  const calculatedFactor = baseFactor + (days * 0.7);

  if (calculatedFactor >= 2.8) {
    level = "CRUCIAL SYSTEM FAILURE";
    headline = "Cascading Schedule Gridlock Cascades";
    critiqueText = `Relying on panic-adrenaline is not a business plan. Prepare for severe review humiliation.`;
    bullets = [
      `Overdue Breach Imminent: Target deadline is squashed into critical priority slots.`,
      `Dependency Lockdown: 2 secondary outputs will starve due to input delays.`,
      `Cognitive Tax Escalation: Expect intensive caffeine dependency to make up lost hours.`
    ];
  } else if (calculatedFactor >= 1.8) {
    level = "PREDICTED TRAUMA";
    headline = "Erosion of Task Buffer Margin";
    critiqueText = `Tomorrow does not hold more discipline than today. It only holds less time.`;
    bullets = [
      `Time Reserve Evaporates: Margin of error drops to absolute zero.`,
      `Panic Mode Activation: Urgent priority trigger threshold breached.`,
      `Slightly lower chance of perfection: Submissions under stress drop in execution quality.`
    ];
  } else {
    level = "SENSITIVE IMPACT";
    headline = "Minor Slipped Margin";
    critiqueText = `A subtle delay, but inertia is highly contagious. Take extreme care.`;
    bullets = [
      `Slight schedule friction: Moves task closer to primary work slots.`,
      `Discipline rating drops: Your productivity index incurs a minor temporary penalty.`
    ];
  }

  return {
    threatLevel: level,
    riskFactor: calculatedFactor,
    headline: headline,
    critique: critiqueText,
    bulletThreats: bullets
  };
}

// Global simulation output offline engine (matches structures requested from AI models)
export function analyzeCrisisInput(text: string) {
  const lowercase = text.toLowerCase();
  
  // 1. Detect Event / Task type
  let eventType = "Emergency Action Plan";
  let topic = "";
  let category: 'exam' | 'presentation' | 'code' | 'report' | 'interview' | 'general' = 'general';

  if (lowercase.includes("exam") || lowercase.includes("test") || lowercase.includes("study") || lowercase.includes("quiz") || lowercase.includes("examination")) {
    eventType = "Exam Preparation";
    category = 'exam';
    // try to extract subject
    const matches = text.match(/(?:exam|test|study|quiz|examination)\s+on\s+([A-Za-z0-9 ]+)/i) || 
                    text.match(/(?:for\s+my|for\s+the)\s+([A-Za-z0-9 ]+)\s+(?:exam|test)/i);
    if (matches && matches[1]) {
      topic = matches[1].trim();
    }
  } else if (lowercase.includes("presentation") || lowercase.includes("slides") || lowercase.includes("pitch") || lowercase.includes("speech") || lowercase.includes("talk")) {
    eventType = "Presentation Preparation";
    category = 'presentation';
    const matches = text.match(/(?:presentation|slides|pitch|talk)\s+on\s+([A-Za-z0-9 ]+)/i) || 
                    text.match(/(?:about)\s+([A-Za-z0-9 ]+)\s+(?:presentation)/i);
    if (matches && matches[1]) {
      topic = matches[1].trim();
    }
  } else if (lowercase.includes("code") || lowercase.includes("bug") || lowercase.includes("deployment") || lowercase.includes("programming") || lowercase.includes("hotfix") || lowercase.includes("release")) {
    eventType = "Code Debugging & Hotfix";
    category = 'code';
    const matches = text.match(/(?:bug|fix|deployment|hotfix)\s+(?:in|for|on)\s+([A-Za-z0-9 ]+)/i);
    if (matches && matches[1]) {
      topic = matches[1].trim();
    }
  } else if (lowercase.includes("report") || lowercase.includes("essay") || lowercase.includes("paper") || lowercase.includes("assignment") || lowercase.includes("document") || lowercase.includes("proposal")) {
    eventType = "Writing & Assembly Sprint";
    category = 'report';
    const matches = text.match(/(?:report|essay|paper|assignment)\s+on\s+([A-Za-z0-9 ]+)/i);
    if (matches && matches[1]) {
      topic = matches[1].trim();
    }
  } else if (lowercase.includes("interview") || lowercase.includes("meeting") || lowercase.includes("recruiting") || lowercase.includes("job")) {
    eventType = "Interview Prep & Drill";
    category = 'interview';
    const matches = text.match(/(?:interview|meeting)\s+for\s+([A-Za-z0-9 ]+)/i);
    if (matches && matches[1]) {
      topic = matches[1].trim();
    }
  }

  // Fallback / General keyword extraction
  if (!topic) {
    // Look for keywords after "on", "about", "for"
    const generalMatch = text.match(/(?:on|about|for|studying)\s+([A-Za-z0-9 ]+)/i);
    if (generalMatch && generalMatch[1]) {
      const candidate = generalMatch[1].trim().split(/\s+(?:tomorrow|today|at|in|and|before|but|my|with|is|has)\b/i)[0];
      if (candidate && candidate.length > 2 && candidate.length < 50) {
        topic = candidate;
      }
    }
  }

  // Clean topic from trailing spaces or words
  if (topic) {
    topic = topic.replace(/\b(?:tomorrow|today|at|in|and|before|but|my|with|is|has|the|this|a|an)\b.*/i, '').trim();
  }

  // 2. Extract Deadline / Timeframe
  let deadline = "Immediate Window";
  if (lowercase.includes("tomorrow at 8 am") || lowercase.includes("tomorrow morning at 8")) {
    deadline = "Tomorrow at 8:00 AM";
  } else if (lowercase.includes("tomorrow morning")) {
    deadline = "Tomorrow Morning";
  } else if (lowercase.includes("tomorrow afternoon")) {
    deadline = "Tomorrow Afternoon";
  } else if (lowercase.includes("tomorrow")) {
    deadline = "Tomorrow";
  } else if (lowercase.includes("tonight")) {
    deadline = "Tonight";
  } else {
    // search for "in X hours"
    const hoursMatch = lowercase.match(/in\s+(\d+)\s+hours?/);
    if (hoursMatch && hoursMatch[1]) {
      deadline = `In ${hoursMatch[1]} Hours`;
    } else {
      const matchAt = text.match(/at\s+(\d+(?::\d+)?\s*(?:am|pm)?)/i);
      if (matchAt && matchAt[1]) {
        deadline = `Today at ${matchAt[1]}`;
      }
    }
  }

  // 3. Estimate Urgency & Success Probability
  let urgency = "High Urgency";
  let prob = 85;
  if (lowercase.includes("haven't studied") || lowercase.includes("haven't started") || lowercase.includes("blank") || lowercase.includes("no idea") || lowercase.includes("completely lost")) {
    urgency = "CRITICAL LIMITS";
    prob = 62;
  } else if (lowercase.includes("overwhelmed") || lowercase.includes("panic") || lowercase.includes("stressed")) {
    urgency = "SEVERE OUTBREAK";
    prob = 74;
  } else {
    urgency = "HIGH PRIORITY ALERT";
    prob = 88;
  }

  return {
    eventType,
    topic: topic || "Core Priority Target",
    category,
    deadline,
    urgency,
    prob
  };
}

export function simulateGeminiOfflineOutputs(prompt: string, appTasks: Task[], crisisDesc?: string): any {
  // 1. Prioritization Sim
  if (prompt.includes("dynamic priority ratings") || prompt.includes("taskId")) {
    const activePending = appTasks.filter(t => t.status === 'Pending');
    return activePending.map(t => {
      const deadline = new Date(t.deadline);
      const hrsLeft = (deadline.getTime() - new Date().getTime()) / (3600 * 1000);
      
      let targetPriority: 'High' | 'Medium' | 'Low' = "Low";
      let rationale = "Generous margin target. Settle down secondary details.";
      
      if (hrsLeft < 18) {
        targetPriority = "High";
        rationale = "Critical threat. Extreme imminent date requirement requires instant prioritisation shift.";
      } else if (hrsLeft < 48) {
        targetPriority = "High";
        rationale = "Project deadline falls tomorrow. Core block staging required today.";
      } else if (hrsLeft < 96) {
        targetPriority = "Medium";
        rationale = "Due within 3-4 days. Schedule active intermediate focus intervals.";
      }
      
      return {
        taskId: t.id,
        newPriority: targetPriority,
        reason: rationale
      };
    });
  }

  // 2. Schedule timeline sim
  if (prompt.includes("hour-by-hour productive timeline") || prompt.includes("8:00 AM")) {
    const activeTitles = appTasks.filter(t => t.status === 'Pending').map(t => t.title);
    const primary = activeTitles[0] || "Core Academic Priority";
    const secondary = activeTitles[1] || "Review Secondary Workloads";
    const tertiary = activeTitles[2] || "Update documentation details";

    return [
      { time: "08:00 AM", action: "Daily alignment briefing & Aheadly overview", duration: "30 mins" },
      { time: "08:30 AM", action: `Deep focus high-intensity block: "${primary}"`, duration: "2 hrs" },
      { time: "10:30 AM", action: "Restorative break & Mindful alignment checkout", duration: "15 mins" },
      { time: "10:45 AM", action: `Midday execution block: "${secondary}"`, duration: "1.5 hrs" },
      { time: "12:15 PM", action: "Nutrition interval & Cognitive recharge loop", duration: "1 hr" },
      { time: "01:15 PM", action: `Secondary triage block: "${tertiary}"`, duration: "1 hr" },
      { time: "02:15 PM", action: "Weekly planning updates & Inbox alignment sweeps", duration: "45 mins" }
    ] as ScheduleBlock[];
  }

  // 3. Crisis Rescue analysis Sim
  if (prompt.includes("Action emergency threat") || prompt.includes("emergency focus protocol") || prompt.includes("reprioritizedTaskList")) {
    const active = appTasks.filter(t => t.status === 'Pending');
    const userCrisis = crisisDesc || "";
    
    const analysis = analyzeCrisisInput(userCrisis);
    
    // Build dynamic plans based on category
    let reprioritized: { title: string; reason: string }[] = [];
    let quickstart = "";
    let timeline: { time: string; action: string; risk: string }[] = [];
    
    const topicName = analysis.topic;
    
    if (analysis.category === 'exam') {
      reprioritized = [
        { title: `Prioritize Exam Preparation: ${topicName}`, reason: `Focus strictly on high-yield exam topics and core study material for ${topicName}.` },
        { title: `Create an Emergency Study Plan`, reason: `Partition your remaining hours into focused active recall segments instead of passive reading.` },
        { title: `Suggest Topics to Cover First`, reason: `Identify the top 3 highest-probability topics or formulas in ${topicName} that are guaranteed to yield marks.` }
      ];
      quickstart = `Open your ${topicName} syllabus or notes, and read just the first 3 core headings.`;
      timeline = [
        { time: "T-minus 12h", action: `Compile active recall summary sheets for ${topicName}`, risk: "High" },
        { time: "T-minus 6h", action: `Run timed mock questions & review errors`, risk: "Medium" },
        { time: "T-minus 1h", action: `Mindful review, deep hydration, and cognitive rest before the exam`, risk: "Low" }
      ];
    } else if (analysis.category === 'presentation') {
      reprioritized = [
        { title: `Create a Presentation Preparation Plan`, reason: `Develop an outline of your slides and speech sequence for ${topicName} to build immediate narrative confidence.` },
        { title: `Suggest Slide Preparation Sequence`, reason: `Flesh out visual and textual slide layout elements. Keep slide text minimal (one central key idea).` },
        { title: `Immediate Actions for ${topicName} Presentation`, reason: `Rehearse the introductory hook and slide transitions aloud to check exact speech timings.` }
      ];
      quickstart = `Open your slide editor software, create a new blank project, and write down the ${topicName} title.`;
      timeline = [
        { time: "T-minus 12h", action: `Define 6 narrative slide headlines for ${topicName}`, risk: "High" },
        { time: "T-minus 4h", action: `Practice presenting out loud twice with a mobile timer`, risk: "Medium" },
        { time: "T-minus 1h", action: `Perform screenshare and visual check on projector/monitor`, risk: "Low" }
      ];
    } else if (analysis.category === 'code') {
      reprioritized = [
        { title: `Isolate and Reproduce Code Defect in ${topicName}`, reason: `Execute target logs, review bug reports, or trace system console dumps to identify the exact source file and failing method.` },
        { title: `Develop Targeted Hotfix Patches`, reason: `Write minimal patch logic to safeguard operations before full refactoring. Focus purely on error boundaries in ${topicName}.` },
        { title: `Linter & Compilation Regression Tests`, reason: `Run TypeScript verification and production builds to ensure no cascading side-effects exist.` }
      ];
      quickstart = `Open your code editor, locate the failing ${topicName} file, and add a single print statement or comment highlighting the error block.`;
      timeline = [
        { time: "T-minus 8h", action: `Reproduce error state and trace call stack logs for ${topicName}`, risk: "High" },
        { time: "T-minus 4h", action: `Deploy targeted code fix and execute local verification`, risk: "Medium" },
        { time: "T-minus 1h", action: `Run full production build and regression test suite`, risk: "Low" }
      ];
    } else if (analysis.category === 'report') {
      reprioritized = [
        { title: `Establish Structural Skeleton for ${topicName}`, reason: `Define the table of contents and heading blocks to immediately partition the blank document into manageable sections.` },
        { title: `Flesh Out Core Evidence and Section Paragraphs`, reason: `Write fast drafts without self-editing. Focus on getting ideas on paper; formatting and styling can be polished later.` },
        { title: `Verify Citations, Charts, and Executive Summary`, reason: `Draft a 150-word high-impact overview of ${topicName} and review formatting alignments to look professional.` }
      ];
      quickstart = `Open your word document editor, save a new file as "${topicName} Final Draft", and write the title heading.`;
      timeline = [
        { time: "T-minus 6h", action: `Write 3 primary sub-sections of the ${topicName} report`, risk: "High" },
        { time: "T-minus 2h", action: `Integrate core charts, visual statistics, and references`, risk: "Medium" },
        { time: "T-minus 1h", action: `Run spellchecker and format margins/typography`, risk: "Low" }
      ];
    } else if (analysis.category === 'interview') {
      reprioritized = [
        { title: `System Architecture & Technical Review for ${topicName}`, reason: `Review core structural blocks (scaling, databases, caching) and prepare high-impact engineering talking points.` },
        { title: `Behavioral STAR-Format Outline Drafts`, reason: `Prepare 3 stories demonstrating leadership, conflict resolution, and complex problem-solving based on ${topicName}.` },
        { title: `Mock Explanation and Code Structure Drills`, reason: `Practice speaking out loud while tracing logical structures on a clean sheet of paper or whiteboard.` }
      ];
      quickstart = `Take a blank sheet of paper, write "My Top 3 Achievements on ${topicName}" at the top, and note down 3 bullet points.`;
      timeline = [
        { time: "T-minus 10h", action: `Deep-dive into architectural patterns and tech stack for ${topicName}`, risk: "High" },
        { time: "T-minus 4h", action: `Refine STAR response outlines and project impact metrics`, risk: "Medium" },
        { time: "T-minus 1h", action: `Optimize your virtual meeting workspace, camera, and lighting`, risk: "Low" }
      ];
    } else {
      // General / fallback
      reprioritized = [
        { title: `Formulate Core Strategy for ${topicName}`, reason: `Identify the absolute minimal viable output required to prevent project failure and center all focus on it.` },
        { title: `Eliminate Non-Essential Tasks & Scheduling Noise`, reason: `Defer existing non-urgent items to clear immediate calendar slots and avoid mental context-switching.` },
        { title: `Execute Draft Skeleton Loop`, reason: `Build the structural backbone of your deliverable so that you can add assets incrementally.` }
      ];
      quickstart = `Select exactly 1 file or note relevant to ${topicName}, open it, and type 3 quick bullet items.`;
      timeline = [
        { time: "T-minus 12h", action: `Outline primary delivery milestones for ${topicName}`, risk: "High" },
        { time: "T-minus 6h", action: `Execute core focus sprint on first high-impact blocker`, risk: "Medium" },
        { time: "T-minus 1h", action: `Final verification check and status reporting setup`, risk: "Low" }
      ];
    }

    // Handle tasks to postpone or abandon from the existing appTasks!
    let toPostpone: { title: string; postponeReason: string }[] = [];
    let toAbandon: { title: string; abandonReason: string }[] = [];

    if (active.length > 0) {
      // Postpone the first 2 tasks from active list
      const postTask1 = active[0];
      toPostpone.push({
        title: postTask1.title,
        postponeReason: `Recommend postponing lower-priority tasks: Deferring "${postTask1.title}" clears up ${postTask1.estTime} hours of critical focus time for your current emergency.`
      });
      
      if (active.length > 1) {
        const postTask2 = active[1];
        toPostpone.push({
          title: postTask2.title,
          postponeReason: `Deferring "${postTask2.title}" causes zero near-term risk and provides perfect buffer space.`
        });
      }

      // Abandon the last task from active list or a routine task
      const abanTask = active[active.length - 1];
      // If we only have 1 active task, don't double count it as abandon and postpone.
      if (abanTask.id !== postTask1.id) {
        toAbandon.push({
          title: abanTask.title,
          abandonReason: `Dropping "${abanTask.title}" from your active schedule for now avoids cognitive fatigue and allows you to put 100% of your energy into the current crisis.`
        });
      } else {
        toAbandon.push({
          title: "Routine Email Catch-up",
          abandonReason: "Has practically zero immediate project outcomes. Deleting this weekly requirement frees critical bandwidth."
        });
      }
    } else {
      // default fallbacks if no tasks
      toPostpone.push({
        title: "Routine Administrative Tasks",
        postponeReason: "These low-priority back-office chores can be safely delayed until next week."
      });
      toAbandon.push({
        title: "General Email Inbox Cleanup",
        abandonReason: "Has practically zero immediate outcomes. Return to it when time allows."
      });
    }

    return {
      reprioritizedTaskList: reprioritized,
      tasksToPostpone: toPostpone,
      tasksToAbandon: toAbandon,
      quickstartAction: quickstart,
      emergencyTimeline: timeline,
      estimatedSuccessProbability: analysis.prob
    } as RescueMatrix;
  }

  // 4. Inertia bypass micro-step sim
  if (prompt.includes("ridiculously uncomplicated") || prompt.includes("microStep")) {
    const matchTitle = prompt.match(/Title:\s*"([^"]+)"/);
    const title = matchTitle ? matchTitle[1] : "Active task tracking element";
    
    return {
      microStep: `Open your workspace window, rename exactly 1 document heading to: "${title} Baseline Structure", and draft 3 quick bullet items.`
    };
  }

  return {};
}
