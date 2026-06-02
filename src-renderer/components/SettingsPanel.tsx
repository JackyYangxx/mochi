import React, { useState, useEffect, useRef } from 'react';
import './SettingsPanel.css';
import { useStore } from '../store';

type TabKey = 'appearance' | 'intelligence' | 'notification' | 'system';

interface Settings {
  llmEndpoint: string;
  llmModel: string;
  imCliPath: string;
  imCliArgs: string;
  reminderTimes: string[];
  autoLaunch: boolean;
}

interface PetImages {
  idle: string | null;
  active: string | null;
  speaking: string | null;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'appearance', label: '外观' },
  { key: 'intelligence', label: '智能' },
  { key: 'notification', label: '通知' },
  { key: 'system', label: '系统' },
];

const PET_STATE_LABELS: Record<keyof PetImages, string> = {
  idle: '闲置',
  active: '活动',
  speaking: '说话',
};

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('appearance');
  const petSize = useStore((s) => s.petSize);
  const [settings, setSettings] = useState<Settings>({
    llmEndpoint: '',
    llmModel: '',
    imCliPath: '',
    imCliArgs: '',
    reminderTimes: ['21:00'],
    autoLaunch: false,
  });
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [petImages, setPetImages] = useState<PetImages>({ idle: null, active: null, speaking: null });
  const [reportDir, setReportDir] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<{ [key: string]: HTMLInputElement | null }>({
    idle: null,
    active: null,
    speaking: null,
  });

  const loadSettings = async () => {
    try {
      const all = await window.todoAPI.getSettings();
      if (all) {
        setSettings({
          llmEndpoint: all.llmEndpoint || '',
          llmModel: all.llmModel || '',
          imCliPath: all.imCliPath || '',
          imCliArgs: all.imCliArgs || '',
          reminderTimes: all.reminderTimes ? JSON.parse(all.reminderTimes) : ['21:00'],
          autoLaunch: all.autoLaunch === 'true',
        });
      }
      const key = await window.todoAPI.getApiKey();
      setApiKey(key || '');

      const images = await window.todoAPI.getPetImages();
      if (images) {
        setPetImages({
          idle: images.idle || null,
          active: images.active || null,
          speaking: images.speaking || null,
        });
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  };

  useEffect(() => {
    loadSettings();
    const loadDir = async () => {
      const dir = await window.todoAPI.getReportDir();
      if (dir) setReportDir(dir);
    };
    loadDir();
  }, []);

  const saveSetting = async (key: string, value: string) => {
    try {
      await window.todoAPI.updateSetting(key, value);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  };

  const handleSaveApiKey = async () => {
    try {
      await window.todoAPI.setApiKey(apiKey);
    } catch (error) {
      console.error('保存 API Key 失败:', error);
    }
  };

  const handleAddReminderTime = () => {
    const newTimes = [...settings.reminderTimes, '21:00'];
    setSettings({ ...settings, reminderTimes: newTimes });
    saveSetting('reminderTimes', JSON.stringify(newTimes));
  };

  const handleRemoveReminderTime = (index: number) => {
    const newTimes = settings.reminderTimes.filter((_, i) => i !== index);
    setSettings({ ...settings, reminderTimes: newTimes });
    saveSetting('reminderTimes', JSON.stringify(newTimes));
  };

  const handleReminderTimeChange = (index: number, value: string) => {
    const newTimes = [...settings.reminderTimes];
    newTimes[index] = value;
    setSettings({ ...settings, reminderTimes: newTimes });
    saveSetting('reminderTimes', JSON.stringify(newTimes));
  };

  const handleAutoLaunchChange = (value: boolean) => {
    setSettings({ ...settings, autoLaunch: value });
    saveSetting('autoLaunch', value.toString());
  };

  const handleUploadPetImage = async (state: 'idle' | 'active' | 'speaking') => {
    const input = fileInputRef.current[state];
    if (!input || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    try {
      await window.todoAPI.uploadPetImage(state, file.path);
      const images = await window.todoAPI.getPetImages();
      if (images) {
        const newImages = {
          idle: images.idle || null,
          active: images.active || null,
          speaking: images.speaking || null,
        };
        setPetImages(newImages);
        useStore.getState().setPetImages(newImages);
      }
    } catch (error) {
      console.error('上传宠物图片失败:', error);
    } finally {
      input.value = '';
    }
  };

  const handleResetPetImage = async (state: 'idle' | 'active' | 'speaking') => {
    try {
      await window.todoAPI.resetPetImage(state);
      const images = await window.todoAPI.getPetImages();
      if (images) {
        const newImages = {
          idle: images.idle || null,
          active: images.active || null,
          speaking: images.speaking || null,
        };
        setPetImages(newImages);
        useStore.getState().setPetImages(newImages);
      }
    } catch (error) {
      console.error('重置宠物图片失败:', error);
    }
  };

  const handleSelectReportDir = async () => {
    const dir = window.prompt('请输入日报保存目录路径:', reportDir);
    if (dir) {
      await window.todoAPI.setReportDir(dir);
      setReportDir(dir);
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const result = await window.todoAPI.generateDailyReport();
      if (result.success) {
        alert(`日报已生成：${result.reportPath}`);
      } else {
        alert(`生成失败：${result.error}`);
      }
    } catch (err) {
      alert(`生成失败：${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderImagePreview = (state: 'idle' | 'active' | 'speaking') => {
    const src = petImages[state];
    if (src) {
      return (
        <div className="pet-image-preview">
          <img src={`file://${src}`} alt={PET_STATE_LABELS[state]} />
        </div>
      );
    }
    return <div className="pet-image-placeholder" aria-label="未设置">+</div>;
  };

  // ============================================================
  // Tab: 外观
  // ============================================================
  const renderAppearanceTab = () => (
    <>
      <section className="settings-section">
        <h3>宠物大小</h3>
        <p className="section-description">调整桌面宠物在屏幕上的显示尺寸</p>
        <div className="form-field">
          <select
            className="form-select"
            value={petSize}
            onChange={(e) =>
              useStore.getState().setPetSize(e.target.value as 'small' | 'medium' | 'large')
            }
          >
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>宠物图片</h3>
        <p className="section-description">为不同状态自定义宠物图片，支持 PNG / JPG / GIF</p>
        <div className="pet-images-grid">
          {(['idle', 'active', 'speaking'] as const).map((state) => (
            <div key={state} className="pet-image-item">
              {renderImagePreview(state)}
              <span className="pet-image-label">{PET_STATE_LABELS[state]}</span>
              <input
                ref={(el) => {
                  fileInputRef.current[state] = el;
                }}
                type="file"
                accept="image/*"
                onChange={() => handleUploadPetImage(state)}
                style={{ display: 'none' }}
              />
              <div className="pet-image-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => fileInputRef.current[state]?.click()}
                >
                  选择
                </button>
                <button className="btn btn-danger" onClick={() => handleResetPetImage(state)}>
                  重置
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  // ============================================================
  // Tab: 智能
  // ============================================================
  const renderIntelligenceTab = () => (
    <section className="settings-section">
      <h3>LLM 接口</h3>
      <p className="section-description">配置用于智能分类与日报生成的大语言模型服务</p>

      <div className="form-field">
        <label htmlFor="llm-endpoint">服务地址</label>
        <input
          id="llm-endpoint"
          className="form-input"
          type="text"
          value={settings.llmEndpoint}
          onChange={(e) => {
            setSettings({ ...settings, llmEndpoint: e.target.value });
            saveSetting('llmEndpoint', e.target.value);
          }}
          placeholder="https://api.example.com/v1/chat/completions"
        />
      </div>

      <div className="form-field">
        <label htmlFor="llm-model">模型名称</label>
        <input
          id="llm-model"
          className="form-input"
          type="text"
          value={settings.llmModel}
          onChange={(e) => {
            setSettings({ ...settings, llmModel: e.target.value });
            saveSetting('llmModel', e.target.value);
          }}
          placeholder="gpt-4o-mini"
        />
      </div>

      <div className="form-field">
        <label htmlFor="llm-api-key">API Key</label>
        <div className="form-row">
          <input
            id="llm-api-key"
            className="form-input"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="请输入 API Key"
            autoComplete="off"
          />
          <button
            className="btn btn-secondary"
            onClick={() => setShowApiKey(!showApiKey)}
            aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
          >
            {showApiKey ? '隐藏' : '显示'}
          </button>
          <button className="btn btn-primary" onClick={handleSaveApiKey}>
            保存
          </button>
        </div>
        <span className="form-hint">Key 存储于系统 Keychain，仅本机可解密</span>
      </div>
    </section>
  );

  // ============================================================
  // Tab: 通知
  // ============================================================
  const renderNotificationTab = () => (
    <>
      <section className="settings-section">
        <h3>每日提醒</h3>
        <p className="section-description">在指定时间通过桌面通知和 IM 推送当日待办</p>
        <div className="reminder-list">
          {settings.reminderTimes.map((time, index) => (
            <div key={index} className="reminder-item">
              <input
                className="form-input"
                type="time"
                value={time}
                onChange={(e) => handleReminderTimeChange(index, e.target.value)}
              />
              <button
                className="btn btn-icon"
                onClick={() => handleRemoveReminderTime(index)}
                disabled={settings.reminderTimes.length <= 1}
                aria-label="删除提醒时间"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={handleAddReminderTime}>
          + 添加提醒时间
        </button>
      </section>

      <section className="settings-section">
        <h3>IM 推送</h3>
        <p className="section-description">通过本地命令行工具把通知推送到 IM（钉钉 / 飞书 / Slack 等）</p>

        <div className="form-field">
          <label htmlFor="im-cli-path">命令行路径</label>
          <input
            id="im-cli-path"
            className="form-input"
            type="text"
            value={settings.imCliPath}
            onChange={(e) => {
              setSettings({ ...settings, imCliPath: e.target.value });
              saveSetting('imCliPath', e.target.value);
            }}
            placeholder="/usr/local/bin/send-notification"
          />
        </div>

        <div className="form-field">
          <label htmlFor="im-cli-args">参数模板</label>
          <input
            id="im-cli-args"
            className="form-input"
            type="text"
            value={settings.imCliArgs}
            onChange={(e) => {
              setSettings({ ...settings, imCliArgs: e.target.value });
              saveSetting('imCliArgs', e.target.value);
            }}
            placeholder="-t {content}"
          />
          <span className="form-hint">使用 {'{content}'} 作为消息内容占位符</span>
        </div>
      </section>

      <section className="settings-section">
        <h3>日报</h3>
        <p className="section-description">基于当天已完成的待办自动生成 Markdown 日报</p>

        <div className="form-field">
          <label htmlFor="report-dir">保存目录</label>
          <div className="form-row">
            <input
              id="report-dir"
              className="form-input"
              type="text"
              value={reportDir}
              onChange={(e) => setReportDir(e.target.value)}
              placeholder="选择日报保存目录"
              readOnly
            />
            <button className="btn btn-secondary" onClick={handleSelectReportDir}>
              选择
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleGenerateReport}
          disabled={isGenerating}
        >
          {isGenerating ? '生成中…' : '生成日报'}
        </button>
      </section>
    </>
  );

  // ============================================================
  // Tab: 系统
  // ============================================================
  const renderSystemTab = () => (
    <section className="settings-section">
      <h3>开机自启</h3>
      <p className="section-description">登录系统时自动启动 Desktop Todo</p>
      <div
        className="toggle-row"
        onClick={() => handleAutoLaunchChange(!settings.autoLaunch)}
        role="switch"
        aria-checked={settings.autoLaunch}
      >
        <span>开机时自动启动</span>
        <div className={`toggle-switch ${settings.autoLaunch ? 'active' : ''}`}>
          <div className="toggle-slider" />
        </div>
      </div>
    </section>
  );

  return (
    <div className="settings-panel">
      <header className="settings-header">
        <h2>Desktop Todo</h2>
        <button className="settings-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </header>

      <nav className="settings-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="settings-content">
        {activeTab === 'appearance' && renderAppearanceTab()}
        {activeTab === 'intelligence' && renderIntelligenceTab()}
        {activeTab === 'notification' && renderNotificationTab()}
        {activeTab === 'system' && renderSystemTab()}
      </main>
    </div>
  );
}
