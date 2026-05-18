export interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
}

export interface TodoCreateInput {
  content: string;
}

export interface ReminderConfig {
  times: string[];
  imCliPath: string;
  imCliArgs: string;
}

export interface LLMConfig {
  endpoint: string;
  model: string;
}

export interface PetImages {
  idle: string | null;
  active: string | null;
  speaking: string | null;
}

export type PetState = 'idle' | 'active' | 'speaking';

export interface AppSettings {
  reminderTimes: string[];
  imCliPath: string;
  imCliArgs: string;
  petImageIdle: string;
  petImageActive: string;
  petImageSpeaking: string;
  windowPositionX: number;
  windowPositionY: number;
  autoLaunch: boolean;
  llmEndpoint: string;
  llmModel: string;
  lastReminderDate: string;
  dbVersion: number;
}

export interface IPCApi {
  getTodos: () => Promise<Todo[]>;
  addTodo: (input: TodoCreateInput) => Promise<Todo>;
  toggleTodo: (id: string) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<void>;
  updateSortOrder: (ids: string[]) => Promise<void>;
  searchTodos: (query: string) => Promise<Todo[]>;
  getSettings: () => Promise<Partial<AppSettings>>;
  updateSetting: (key: string, value: string) => Promise<void>;
  getApiKey: () => Promise<string | null>;
  setApiKey: (key: string) => Promise<void>;
  startSpeechRecognition: () => Promise<string>;
  uploadPetImage: (state: PetState, filePath: string) => Promise<string>;
  getPetImages: () => Promise<PetImages>;
  exportData: () => Promise<string>;
  importData: (filePath: string) => Promise<void>;
  sendTestReminder: () => Promise<void>;
  onTriggerInput: (callback: () => void) => () => void;
  onPetStateChange: (callback: (state: PetState) => void) => () => void;
}
