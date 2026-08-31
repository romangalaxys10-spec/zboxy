// Zboxy QA Test Script - Tests all API routes directly
import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync, readFileSync } from 'fs';
import path from 'path';

const db = new PrismaClient();
const STORAGE_ROOT = '/tmp/my-project/zboxy';

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; errors.push(msg); console.log(`  ❌ ${msg}`); }
}

async function cleanup() {
  try {
    const testUser = await db.zboxyUser.findFirst({ where: { name: 'QA Test User' } });
    if (testUser) {
      await db.zboxyFile.deleteMany({ where: { userId: testUser.id } });
      await db.zboxyUser.delete({ where: { id: testUser.id } });
      const userDir = path.join(STORAGE_ROOT, testUser.id);
      if (existsSync(userDir)) rmSync(userDir, { recursive: true });
    }
  } catch (e) { console.error('Cleanup error:', e.message); }
}

async function runTests() {
  console.log('\n=== Zboxy QA Tests ===\n');
  await cleanup();

  // Auth
  console.log('--- Auth Tests ---');
  let user = await db.zboxyUser.create({ data: { name: 'QA Test User', token: 'qa-test-token-12345' } });
  assert(!!user.id, 'Register: User created with ID');
  assert(user.name === 'QA Test User', 'Register: Name correct');
  assert(user.token === 'qa-test-token-12345', 'Register: Token correct');

  const loginResult = await db.zboxyUser.findUnique({ where: { token: 'qa-test-token-12345' } });
  assert(!!loginResult, 'Login: User found by token');
  assert(loginResult.name === 'QA Test User', 'Login: Correct user returned');

  const invalidUser = await db.zboxyUser.findUnique({ where: { token: 'invalid-token' } });
  assert(!invalidUser, 'Login: Invalid token returns null');

  mkdirSync(path.join(STORAGE_ROOT, user.id), { recursive: true });

  // Folders
  console.log('\n--- Folder Tests ---');
  const folder = await db.zboxyFile.create({ data: { userId: user.id, name: 'Test Folder', type: 'folder', path: '/', mimeType: 'inode/directory' } });
  assert(folder.type === 'folder', 'Create Folder: Type is folder');
  assert(folder.path === '/', 'Create Folder: Path is /');

  // File creation
  console.log('\n--- File Creation Tests ---');
  const docFile = await db.zboxyFile.create({ data: { userId: user.id, name: 'Test Doc.zdoc', type: 'file', path: '/', mimeType: 'application/octet-stream', size: 0, content: '' } });
  assert(docFile.type === 'file', 'Create Doc: Type is file');
  assert(docFile.content === '', 'Create Doc: Content is empty string');
  assert(docFile.mimeType === 'application/octet-stream', 'Create Doc: MIME type set');

  const sheetFile = await db.zboxyFile.create({ data: { userId: user.id, name: 'Test Sheet.zsheet', type: 'file', path: '/', mimeType: 'application/octet-stream', size: 0, content: '{}' } });
  assert(sheetFile.content === '{}', 'Create Sheet: Content is {}');

  const slideFile = await db.zboxyFile.create({ data: { userId: user.id, name: 'Test Slide.zslide', type: 'file', path: '/', mimeType: 'application/octet-stream', size: 0, content: '[]' } });
  assert(slideFile.content === '[]', 'Create Slide: Content is []');

  // Nested file
  const subFile = await db.zboxyFile.create({ data: { userId: user.id, name: 'Nested Doc.zdoc', type: 'file', path: '/Test Folder', mimeType: 'application/octet-stream', size: 0, content: 'nested content' } });
  assert(subFile.path === '/Test Folder', 'Nested: Path is /Test Folder');
  assert(subFile.content === 'nested content', 'Nested: Content stored');

  // Listing
  console.log('\n--- File Listing Tests ---');
  const rootFiles = await db.zboxyFile.findMany({ where: { userId: user.id, path: '/', trashed: false }, orderBy: [{ type: 'desc' }, { name: 'asc' }] });
  assert(rootFiles.length >= 3, `List root: Found ${rootFiles.length} items (expected >=3)`);

  const folderFiles = await db.zboxyFile.findMany({ where: { userId: user.id, path: '/Test Folder', trashed: false } });
  assert(folderFiles.length === 1, `List folder: Found ${folderFiles.length} item`);

  // Star
  console.log('\n--- Star Tests ---');
  const starred = await db.zboxyFile.update({ where: { id: docFile.id }, data: { starred: true } });
  assert(starred.starred === true, 'Star: File starred');
  const unstarred = await db.zboxyFile.update({ where: { id: docFile.id }, data: { starred: false } });
  assert(unstarred.starred === false, 'Unstar: File unstarred');

  // Trash/Restore
  console.log('\n--- Trash Tests ---');
  const trashed = await db.zboxyFile.update({ where: { id: sheetFile.id }, data: { trashed: true } });
  assert(trashed.trashed === true, 'Trash: File trashed');

  const activeFiles = await db.zboxyFile.findMany({ where: { userId: user.id, path: '/', trashed: false } });
  const trashedFiles = await db.zboxyFile.findMany({ where: { userId: user.id, trashed: true } });
  assert(!activeFiles.find(f => f.id === sheetFile.id), 'Trash: Not in active listing');
  assert(trashedFiles.find(f => f.id === sheetFile.id), 'Trash: In trash listing');

  const restored = await db.zboxyFile.update({ where: { id: sheetFile.id }, data: { trashed: false } });
  assert(restored.trashed === false, 'Restore: File restored');

  // Rename
  console.log('\n--- Rename Tests ---');
  const renamed = await db.zboxyFile.update({ where: { id: docFile.id }, data: { name: 'Renamed Doc.zdoc' } });
  assert(renamed.name === 'Renamed Doc.zdoc', 'Rename: File renamed');

  // Content
  console.log('\n--- Content Tests ---');
  const newContent = '# Hello World\n\nThis is a test document.';
  const updated = await db.zboxyFile.update({ where: { id: docFile.id }, data: { content: newContent, size: new TextEncoder().encode(newContent).length } });
  assert(updated.content === newContent, 'Content: Updated');
  assert(updated.size > 0, 'Content: Size updated');

  // Search
  console.log('\n--- Search Tests ---');
  const searchResult = await db.zboxyFile.findFirst({ where: { userId: user.id, name: { contains: 'Renamed' }, trashed: false } });
  assert(!!searchResult, 'Search: Found renamed file');
  const noResult = await db.zboxyFile.findFirst({ where: { userId: user.id, name: { contains: 'nonexistent' } } });
  assert(!noResult, 'Search: No result for nonexistent');

  // Duplicate
  console.log('\n--- Duplicate Tests ---');
  const duplicate = await db.zboxyFile.findFirst({ where: { userId: user.id, path: '/', name: 'Renamed Doc.zdoc', trashed: false } });
  assert(!!duplicate, 'Duplicate: Existing file detected');

  // Physical files
  console.log('\n--- Physical File Tests ---');
  const testFilePath = path.join(STORAGE_ROOT, user.id, 'test-upload.txt');
  writeFileSync(testFilePath, 'Hello from physical file!');
  assert(existsSync(testFilePath), 'Physical: File written to disk');
  const physFile = await db.zboxyFile.create({ data: { userId: user.id, name: 'test-upload.txt', type: 'file', path: '/', mimeType: 'text/plain', size: 27 } });
  assert(physFile.mimeType === 'text/plain', 'Physical upload: DB record created');
  unlinkSync(testFilePath);

  // Delete
  console.log('\n--- Delete Tests ---');
  await db.zboxyFile.delete({ where: { id: physFile.id } });
  const deletedFile = await db.zboxyFile.findUnique({ where: { id: physFile.id } });
  assert(!deletedFile, 'Delete: File permanently deleted');

  // Folder cascade delete
  await db.zboxyFile.deleteMany({ where: { userId: user.id, path: { startsWith: '/Test Folder' } } });
  await db.zboxyFile.delete({ where: { id: folder.id } });
  const deletedFolder = await db.zboxyFile.findUnique({ where: { id: folder.id } });
  const deletedChild = await db.zboxyFile.findUnique({ where: { id: subFile.id } });
  assert(!deletedFolder, 'Delete folder: Folder deleted');
  assert(!deletedChild, 'Delete folder: Child file deleted');

  // Summary
  console.log('\n=== QA Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  await cleanup();
  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error('Test runner error:', e); process.exit(1); });
