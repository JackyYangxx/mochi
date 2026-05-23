import { app } from 'electron';
import log from 'electron-log';
import { CLIExecutor } from './CLIExecutor';
import { LLMService } from './LLMService';
import { SettingsService } from './SettingsService';

export class ReminderService {
  private cliExecutor: CLIExecutor;
  private llmService: LLMService;
  private settingsService: SettingsService;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastReminderDate: string = '';

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
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    log.info('ReminderService stopped');
  }

  private async checkAndFire(): Promise<void> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Get reminder times from settings
    const timesStr = this.settingsService.get('reminderTimes');
    if (!timesStr) return;

    const times: string[] = JSON.parse(timesStr);
    if (!times.includes(currentTime)) return;

    // Already sent today
    const lastDate = this.settingsService.get('lastReminderDate');
    if (lastDate === today) {
      log.info('Reminder already sent today, skipping');
      return;
    }

    // Fire reminder
    try {
      await this.fireReminder();
      this.settingsService.set('lastReminderDate', today);
    } catch (err) {
      log.error('Failed to fire reminder:', err);
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
    const { TodoService } = require('./TodoService');
    const { getDb } = require('../database/connection');
    try {
      const db = getDb();
      const service = new TodoService(db);
      return service.getAll().filter((t: any) => !t.isCompleted);
    } catch (err) {
      log.warn('Failed to get incomplete todos, database may be closed:', err);
      return [];
    }
  }
}
