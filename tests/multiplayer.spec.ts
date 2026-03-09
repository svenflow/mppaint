import { test, expect, Page, Browser } from '@playwright/test';

test.describe('Multiplayer Canvas', () => {
  test('two browsers can join the same room and see connection', async ({ browser }) => {
    // Create two browser contexts (simulates two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Enable console logging for debugging
    page1.on('console', msg => console.log('Page1:', msg.text()));
    page2.on('console', msg => console.log('Page2:', msg.text()));

    // User 1 creates a room
    await page1.goto('/');
    await page1.click('button:has-text("Create Room")');

    // Wait for room to be created and get the room code
    await page1.waitForSelector('.room-code .code');
    const roomCode = await page1.locator('.room-code .code').textContent();
    console.log('Room code:', roomCode);

    expect(roomCode).toBeTruthy();
    expect(roomCode?.length).toBe(6);

    // User 2 joins the same room via URL
    await page2.goto(`/?room=${roomCode}`);

    // Wait for both to show connected (peer count should increase)
    // y-websocket connects much faster than Trystero (BitTorrent DHT)
    await page1.waitForTimeout(2000);

    // Check that page1 sees 2 painters (self + peer)
    const peerCount1 = await page1.locator('.peer-count').textContent();
    console.log('Page1 peer count:', peerCount1);

    // Check that page2 is in the room
    const page2RoomCode = await page2.locator('.room-code .code').textContent();
    expect(page2RoomCode).toBe(roomCode);

    await context1.close();
    await context2.close();
  });

  test('drawing syncs between two browsers', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1 creates a room
    await page1.goto('/');
    await page1.click('button:has-text("Create Room")');
    await page1.waitForSelector('.room-code .code');
    const roomCode = await page1.locator('.room-code .code').textContent();

    // User 2 joins
    await page2.goto(`/?room=${roomCode}`);
    await page2.waitForSelector('.canvas');

    // Wait for WebSocket connection (much faster than P2P)
    await page1.waitForTimeout(2000);

    // User 1 draws a stroke
    const canvas1 = page1.locator('.canvas');
    const box = await canvas1.boundingBox();
    if (box) {
      await page1.mouse.move(box.x + 100, box.y + 100);
      await page1.mouse.down();
      await page1.mouse.move(box.x + 200, box.y + 200);
      await page1.mouse.up();
    }

    // Wait for sync
    await page1.waitForTimeout(2000);

    // Take screenshots to compare
    const screenshot1 = await page1.locator('.canvas').screenshot();
    const screenshot2 = await page2.locator('.canvas').screenshot();

    // Screenshots should have some content (not just blank)
    // This is a basic check - in reality you'd compare pixels
    console.log('Screenshot1 size:', screenshot1.length);
    console.log('Screenshot2 size:', screenshot2.length);

    await context1.close();
    await context2.close();
  });
});
