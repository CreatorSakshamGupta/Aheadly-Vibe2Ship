export interface Task {
  id: string;
  title: string;
  deadline: string; // "YYYY-MM-DDTHH:MM" format
  priority: 'High' | 'Medium' | 'Low';
  estTime: number;
  status: 'Pending' | 'Completed';
  snoozeCount: number;
  procrastinationRisk: boolean;
  microStep: string | null;
  microStepCompleted: boolean;
  aiReason: string;
}

export interface ScheduleBlock {
  time: string;
  action: string;
  duration: string;
}

export interface RescueTask {
  title: string;
  reason?: string;
  postponeReason?: string;
  abandonReason?: string;
}

export interface RescueTimelineItem {
  time: string;
  action: string;
  risk: string;
}

export interface RescueMatrix {
  reprioritizedTaskList: RescueTask[];
  tasksToPostpone: RescueTask[];
  tasksToAbandon: RescueTask[];
  quickstartAction: string;
  emergencyTimeline: RescueTimelineItem[];
  estimatedSuccessProbability: number;
}

export interface ProcrastinationResult {
  threatLevel: string;
  riskFactor: number;
  headline: string;
  critique: string;
  bulletThreats: string[];
}
