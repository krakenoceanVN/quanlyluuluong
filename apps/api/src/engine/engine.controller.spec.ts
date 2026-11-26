import { DEFAULT_REDIRECT_TIMING, readTimingMs, redirectPage } from './engine.controller';

const LA =
  '<script charset="UTF-8" id="LA_COLLECT" src="//sdk.51.la/js-sdk-pro.min.js"></script>' +
  '<script>LA.init({id:"X",ck:"X"})</script>';

/** Phần script chuyển trang (khối script cuối cùng trước <noscript>). */
function redirectScript(html: string): string {
  const blocks = html.match(/<script>[\s\S]*?<\/script>/g) ?? [];
  return blocks[blocks.length - 1] ?? '';
}

describe('redirectPage', () => {
  it('waits for window load + afterLoadMs, capped by maxWaitMs (defaults 300 / 1500)', () => {
    const s = redirectScript(redirectPage('https://ad.example/x', [LA]));
    expect(s).toContain("window.addEventListener('load',arm)");
    expect(s).toContain("document.readyState==='complete'");
    expect(s).toContain('setTimeout(go,300)');
    expect(s).toContain('setTimeout(go,1500)');
    expect(s).toContain('location.replace("https://ad.example/x")');
    expect(s).not.toContain(',120)');
  });

  it('uses the configured timing', () => {
    const s = redirectScript(
      redirectPage('https://ad.example/x', [LA], { afterLoadMs: 800, maxWaitMs: 3000 }),
    );
    expect(s).toContain('setTimeout(go,800)');
    expect(s).toContain('setTimeout(go,3000)');
  });

  it('redirects only once (guard flag) and keeps trackers before the redirect script', () => {
    const html = redirectPage('https://ad.example/x', [LA]);
    expect(redirectScript(html)).toContain('if(d)return;d=1;');
    expect(html.indexOf('sdk.51.la')).toBeLessThan(html.indexOf('location.replace'));
    expect(html).toContain(
      '<noscript><meta http-equiv="refresh" content="0;url=https://ad.example/x">',
    );
  });

  it('cannot be broken out of by a target URL containing </script> or quotes', () => {
    const html = redirectPage('https://ad.example/a"</script><script>alert(1)</script>', [LA]);
    expect(html).not.toContain('</script><script>alert(1)');
    expect(redirectScript(html)).toContain('\\u003c/script>');
  });
});

describe('readTimingMs', () => {
  it('falls back on missing or invalid values', () => {
    expect(readTimingMs(undefined, 300)).toBe(300);
    expect(readTimingMs('', 300)).toBe(300);
    expect(readTimingMs('abc', 300)).toBe(300);
  });

  it('parses numbers and clamps to [0, 10000]', () => {
    expect(readTimingMs('800', 300)).toBe(800);
    expect(readTimingMs(-5, 300)).toBe(0);
    expect(readTimingMs('99999', 300)).toBe(10000);
    expect(readTimingMs('250.6', 300)).toBe(251);
  });

  it('exposes the agreed defaults', () => {
    expect(DEFAULT_REDIRECT_TIMING).toEqual({ afterLoadMs: 300, maxWaitMs: 1500 });
  });
});
