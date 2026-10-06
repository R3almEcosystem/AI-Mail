import test from 'node:test';
import assert from 'node:assert/strict';

async function loadRemoteImages() {
  try {
    return await import('../../src/lib/remote-email-images.ts');
  } catch (error) {
    assert.fail('remote email image loader import failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

const png = new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);

test('remote image hydration proxies only validated public HTTPS images into data URLs', async () => {
  const mod = await loadRemoteImages();
  let fetched = 0;
  const result = await mod.hydrateRemoteEmailImages(
    '<img data-remote-src="https://images.example.test/banner.png" alt="banner">',
    {
      resolve: async () => [{ address: '93.184.216.34', family: 4 }],
      fetchPinned: async (_url, address) => {
        fetched += 1;
        assert.equal(address, '93.184.216.34');
        return { status: 200, contentType: 'image/png', body: png };
      },
    },
  );
  assert.equal(fetched, 1);
  assert.equal(result.loaded, 1);
  assert.equal(result.blocked, 0);
  assert.match(result.html, /src="data:image\/png;base64,/);
  assert.ok(!result.html.includes('data-remote-src='));
});

test('remote image hydration rejects private targets before network fetch', async () => {
  const mod = await loadRemoteImages();
  let fetched = false;
  const result = await mod.hydrateRemoteEmailImages(
    '<img data-remote-src="https://internal.example.test/pixel.png">',
    {
      resolve: async () => [{ address: '127.0.0.1', family: 4 }],
      fetchPinned: async () => { fetched = true; throw new Error('must not fetch'); },
    },
  );
  assert.equal(fetched, false);
  assert.equal(result.loaded, 0);
  assert.equal(result.blocked, 1);
  assert.ok(!result.html.includes('src="https://'));
});

test('remote image hydration rejects redirects, SVG/non-image types, and oversized bodies', async () => {
  const mod = await loadRemoteImages();
  const html = '<img data-remote-src="https://images.example.test/a.png"><img data-remote-src="https://images.example.test/b.svg"><img data-remote-src="https://images.example.test/c.png">';
  let call = 0;
  const result = await mod.hydrateRemoteEmailImages(html, {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchPinned: async () => {
      call += 1;
      if (call === 1) return { status: 302, contentType: 'image/png', body: new Uint8Array() };
      if (call === 2) return { status: 200, contentType: 'image/svg+xml', body: new TextEncoder().encode('<svg/>') };
      return { status: 200, contentType: 'image/png', body: new Uint8Array(5_242_881) };
    },
  });
  assert.equal(result.loaded, 0);
  assert.equal(result.blocked, 3);
  assert.ok(!result.html.includes('src="https://'));
});
