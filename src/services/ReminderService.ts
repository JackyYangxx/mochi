import { app } from 'electron';
import log from 'electron-log';
import { CLIExecutor } from './CLIExecutor';
import { LLMService } from './LLMService';
import { SettingsService } from '../services/SettingsService';
import { getDb } from '../database/connection';

export class ReminderService {
  private cliExecutor: CLIExecutor;
  private llmService: LLMService;
  private settingsService: SettingsService;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastReminderDate: string = '';
  private isRunning: boolean = false;

  constructor(
    cliExecutor: CLIExecutor,
    llmService: LLMService,
    settingsService: SettingsService
  ) {
    this.cliExecutor = cliExecutor;
    this.llmService = llmService;
    this.settingsService = settingsService;
  }

  /**
   * Register reminder schedules.
   * Call this after app is ready.
   */
  start(): void {
    this.isRunning = true;
    // Check every minute
    this.checkInterval = setInterval(() => {
      this.checkAndFire();
    }, 60000);

    log.info('ReminderService started');
  }

  /**
   * Stop the reminder service.
   */
  stop(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    log.info('ReminderService stopped');
  }

  private async checkAndFire(): Promise<void> {
    if (!this.isRunning) return;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Get reminder times from settings
    let timesStr: string | null = null;
    try {
      timesStr = this.settingsService.get('reminderTimes');
    } catch (err) {
      log.warn('[Reminder] Failed to get reminderTimes:', err);
      return;
    }
    if (!timesStr) return;

    let times: string[] = [];
    try {
      times = JSON.parse(timesStr);
    } catch (err) {
      log.warn('[Reminder] Failed to parse reminderTimes:', err);
      return;
    }

    if (!times.includes(currentTime)) return;

    // Already sent today
    let lastDate: string | null = null;
    try {
      lastDate = this.settingsService.get('lastReminderDate');
    } catch (err) {
      log.warn('[Reminder] Failed to get lastReminderDate:', err);
      return;
    }
    if (lastDate === today) {
      log.info('Reminder already sent today, skipping');
      return;
    }

    // Fire reminder
    try {
      await this.fireReminder();
      try {
        this.settingsService.set('lastReminderDate', today);
      } catch (err) {
        log.warn('[Reminder] Failed to save lastReminderDate:', err);
      }
    } catch (err) {
      log.error('[Reminder] Failed to fire reminder:', err);
    }
  }

  async fireReminder(): Promise<void> {
    const todos = this.getIncompleteTodos();
    if (todos.length === 0) {
      log.info('No incomplete todos, skipping reminder');
      return;
    }

    let content: string;
    try {
      content = await this.llmService.generateReminderSummary(todos);
    } catch (err) {
      log.warn('LLM failed, using raw todo list:', err);
      content = todos.map((t) => t.content).join('\n');
    }

    const cliPath = this.settingsService.get('imCliPath') || '';
    const cliArgsStr = this.settingsService.get('imCliArgs') || '';

    if (cliPath && cliArgsStr) {
      const rawArgs = cliArgsStr.split(' ').filter(arg => arg.length > 0);
      const cliArgs = rawArgs.map(arg => arg.replace('{content}', content));
      await this.cliExecutor.execute(cliPath, cliArgs);
      log.info('Reminder sent successfully');
    } else {
      log.warn('IM CLI not configured, skipping send');
    }
  }

  private getIncompleteTodos(): { content: string; isCompleted: boolean }[] {
    if (!this.isRunning) return [];

    const { TodoService } = require('./TodoService');
    try {
      const service = new TodoService();
      return service.getAll().filter((t: any) => !t.isCompleted);
    } catch (err) {
      log.warn('[Reminder] Failed to get incomplete todos:', err);
      return [];
    }
  }
}
