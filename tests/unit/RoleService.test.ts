import fs from 'fs';
import path from 'path';
import os from 'os';
import { RoleService } from '../../src/services/RoleService';

describe('RoleService', () => {
  let tmpDir: string;
  let service: RoleService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'role-test-'));
    service = new RoleService(tmpDir);
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('load() returns template on first run when file does not exist', async () => {
    const content = await service.load();
    expect(content).toContain('# 角色');
    expect(content).toContain('## 身份');
    // template file was created
    expect(fs.existsSync(path.join(tmpDir, 'role.md'))).toBe(true);
  });

  test('load() returns existing file content on subsequent runs', async () => {
    fs.writeFileSync(path.join(tmpDir, 'role.md'), '# 角色\n\n## 身份\n- 职业：测试工程师\n', 'utf-8');
    const content = await service.load();
    expect(content).toContain('测试工程师');
  });

  test('load() returns empty string if file is empty', async () => {
    fs.writeFileSync(path.join(tmpDir, 'role.md'), '', 'utf-8');
    const content = await service.load();
    expect(content).toBe('');
  });

  test('load() migrates legacy file into new dataDir on first run', async () => {
    const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'role-legacy-'));
    const legacyFile = path.join(legacyDir, 'role.md');
    fs.writeFileSync(legacyFile, '# 角色\n\n## 身份\n- 职业：migrated user\n', 'utf-8');

    const migrated = new RoleService(tmpDir, legacyFile);
    const content = await migrated.load();
    expect(content).toContain('migrated user');
    expect(fs.existsSync(path.join(tmpDir, 'role.md'))).toBe(true);
    // Legacy file is left in place — we only ever copy one-way.
    expect(fs.existsSync(legacyFile)).toBe(true);

    fs.rmSync(legacyDir, { recursive: true, force: true });
  });

  test('load() does not overwrite an existing new file with legacy content', async () => {
    const newFile = path.join(tmpDir, 'role.md');
    fs.writeFileSync(newFile, '# 角色\n\n## 身份\n- 职业：current\n', 'utf-8');

    const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'role-legacy-'));
    const legacyFile = path.join(legacyDir, 'role.md');
    fs.writeFileSync(legacyFile, 'LEGACY SHOULD NOT WIN', 'utf-8');

    const svc = new RoleService(tmpDir, legacyFile);
    const content = await svc.load();
    expect(content).toContain('current');
    expect(content).not.toContain('LEGACY');

    fs.rmSync(legacyDir, { recursive: true, force: true });
  });

  test('load() creates dataDir if it does not exist', async () => {
    const freshDir = path.join(tmpDir, 'nested', 'deeper');
    const svc = new RoleService(freshDir);
    const content = await svc.load();
    expect(content).toContain('# 角色');
    expect(fs.existsSync(freshDir)).toBe(true);
  });
});
