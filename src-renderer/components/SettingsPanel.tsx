import React, { useState, useEffect, useRef } from 'react';
import './SettingsPanel.css';
import { useStore } from '../store';

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

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
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
  const fileInputRef = useRef<{ [key: string]: HTMLInputElement | null }>({
    idle: null,
    active: null,
    speaking: null,
  });

  useEffect(() => {
    loadSettings();
  }, []);

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
      console.error('Failed to load settings:', error);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await window.todoAPI.updateSetting(key, value);
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  };

  const handleSaveApiKey = async () => {
    try {
      await window.todoAPI.setApiKey(apiKey);
    } catch (error) {
      console.error('Failed to save API key:', error);
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
        setPetImages({
          idle: images.idle || null,
          active: images.active || null,
          speaking: images.speaking || null,
        });
      }
    } catch (error) {
      console.error('Failed to upload pet image:', error);
    }
  };

  const renderImagePreview = (state: 'idle' | 'active' | 'speaking') => {
    const src = petImages[state];
    if (src) {
      return (
        <div className="pet-image-preview">
          <img src={`file://${src}`} alt={state} />
          <span className="pet-image-state">{state}</span>
        </div>
      );
    }
    return (
      <div className="pet-image-placeholder">
        <span className="pet-image-state">{state}</span>
      </div>
    );
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="settings-content">
          {/* LLM API Configuration */}
          <section className="settings-section">
            <h3>LLM API Configuration</h3>
            <div className="settings-field">
              <label>Endpoint URL</label>
              <input
                type="text"
                value={settings.llmEndpoint}
                onChange={(e) => {
                  setSettings({ ...settings, llmEndpoint: e.target.value });
                  saveSetting('llmEndpoint', e.target.value);
                }}
                placeholder="https://api.example.com/v1/chat/completions"
              />
            </div>
            <div className="settings-field">
              <label>Model Name</label>
              <input
                type="text"
                value={settings.llmModel}
                onChange={(e) => {
                  setSettings({ ...settings, llmModel: e.target.value });
                  saveSetting('llmModel', e.target.value);
                }}
                placeholder="gpt-4o-mini"
              />
            </div>
            <div className="settings-field">
              <label>API Key</label>
              <div className="api-key-row">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                />
                <button
                  className="toggle-visibility"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
                <button className="save-api-key" onClick={handleSaveApiKey}>
                  Save
                </button>
              </div>
            </div>
          </section>

          {/* IM CLI Configuration */}
          <section className="settings-section">
            <h3>IM CLI Configuration</h3>
            <div className="settings-field">
              <label>CLI Path</label>
              <input
                type="text"
                value={settings.imCliPath}
                onChange={(e) => {
                  setSettings({ ...settings, imCliPath: e.target.value });
                  saveSetting('imCliPath', e.target.value);
                }}
                placeholder="/usr/local/bin/send-notification"
              />
            </div>
            <div className="settings-field">
              <label>CLI Arguments Template</label>
              <input
                type="text"
                value={settings.imCliArgs}
                onChange={(e) => {
                  setSettings({ ...settings, imCliArgs: e.target.value });
                  saveSetting('imCliArgs', e.target.value);
                }}
                placeholder="-t {content}"
              />
              <span className="field-hint">Use {'{content}'} as placeholder for message content</span>
            </div>
          </section>

          {/* Reminder Time Configuration */}
          <section className="settings-section">
            <h3>Daily Reminder Times</h3>
            <div className="reminder-list">
              {settings.reminderTimes.map((time, index) => (
                <div key={index} className="reminder-item">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => handleReminderTimeChange(index, e.target.value)}
                  />
                  <button
                    className="remove-reminder"
                    onClick={() => handleRemoveReminderTime(index)}
                    disabled={settings.reminderTimes.length <= 1}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button className="add-reminder" onClick={handleAddReminderTime}>
              + Add Reminder Time
            </button>
          </section>

          {/* Auto Launch */}
          <section className="settings-section">
            <h3>Startup</h3>
            <div className="settings-field">
              <label className="toggle-label">
                <span>Launch at system startup</span>
                <div
                  className={`toggle-switch ${settings.autoLaunch ? 'active' : ''}`}
                  onClick={() => handleAutoLaunchChange(!settings.autoLaunch)}
                >
                  <div className="toggle-slider" />
                </div>
              </label>
            </div>
          </section>

          {/* Pet Size */}
          <section className="settings-section">
            <h3>Pet Size</h3>
            <div className="settings-field">
              <label>Pet Size</label>
              <select
                value={useStore((s) => s.petSize)}
                onChange={(e) => useStore.getState().setPetSize(e.target.value as 'small' | 'medium' | 'large')}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </section>

          {/* Pet Images */}
          <section className="settings-section">
            <h3>Pet Images</h3>
            <p className="section-description">Upload images for different pet states</p>
            <div className="pet-images-grid">
              {(['idle', 'active', 'speaking'] as const).map((state) => (
                <div key={state} className="pet-image-upload">
                  <label>{state.charAt(0).toUpperCase() + state.slice(1)} State</label>
                  {renderImagePreview(state)}
                  <input
                    ref={(el) => { fileInputRef.current[state] = el; }}
                    type="file"
                    accept="image/*"
                    onChange={() => handleUploadPetImage(state)}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="upload-button"
                    onClick={() => fileInputRef.current[state]?.click()}
                  >
                    Choose Image
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}