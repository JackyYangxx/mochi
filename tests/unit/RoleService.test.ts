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
});
