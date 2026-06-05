import { WikiIndexService } from '../../src/services/WikiIndexService';

describe('WikiIndexService.tokenize', () => {
  test('lowercases English words and splits on non-alphanumeric', () => {
    const tokens = WikiIndexService.tokenize('Hello, World! Foo-Bar.BAZ');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('foo');
    expect(tokens).toContain('bar');
    expect(tokens).toContain('baz');
  });

  test('emits CJK bigrams for Chinese characters', () => {
    const tokens = WikiIndexService.tokenize('学习编程');
    expect(tokens).toContain('学习');
    expect(tokens).toContain('习编');
    expect(tokens).toContain('编程');
  });

  test('returns empty array for empty string', () => {
    expect(WikiIndexService.tokenize('')).toEqual([]);
  });
});

describe('WikiIndexService.search', () => {
  let svc: WikiIndexService;
  beforeEach(() => {
    svc = new WikiIndexService();
    svc.loadFromPages([
      { path: '/w/git.md', title: 'Git Tutorial', content: 'git commit and git push' },
      { path: '/w/commit.md', title: 'Commit Best Practices', content: 'atomic commits are small' },
    ]);
  });

  test('matches via token overlap', () => {
    const hits = svc.search('git commit', 2);
    expect(hits.map(h => h.path)).toContain('/w/git.md');
  });

  test('title match scores higher than content match', () => {
    const hits = svc.search('commit', 2);
    expect(hits[0].path).toBe('/w/commit.md');  // title match wins
  });
});
