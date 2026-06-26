import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import cors from 'cors';
import express from 'express';

const PORT = Number(process.env.PORT ?? 3001);
const PIPER_BIN = process.env.PIPER_BIN ?? '/usr/local/bin/piper';
const PIPER_MODEL =
  process.env.PIPER_MODEL ?? '/voices/sv_SE-alma-medium.onnx';
const MAX_TEXT_LENGTH = Number(process.env.MAX_TEXT_LENGTH ?? 2000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 60_000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

function validateText(text) {
  if (text === undefined || text === null) {
    return { ok: false, status: 400, error: 'Body must include "text" as a string.' };
  }
  if (typeof text !== 'string') {
    return { ok: false, status: 400, error: '"text" must be a string.' };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: '"text" cannot be empty.' };
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `"text" exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`,
    };
  }
  return { ok: true, text: trimmed };
}

function synthesizeWithPiper(text, outputPath) {
  return new Promise((resolve, reject) => {
    const args = ['--model', PIPER_MODEL, '--output_file', outputPath];
    const child = spawn(PIPER_BIN, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Piper timed out'));
    }, REQUEST_TIMEOUT_MS);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Piper exited with code ${code}`));
    });

    child.stdin.write(text, 'utf8');
    child.stdin.end();
  });
}

app.get('/health', (_req, res) => {
  const modelJson = `${PIPER_MODEL}.json`;
  const ready =
    existsSync(PIPER_BIN) && existsSync(PIPER_MODEL) && existsSync(modelJson);

  res.status(ready ? 200 : 503).json({
    ok: ready,
    voice: 'sv_SE-alma-medium',
    piper: PIPER_BIN,
    model: PIPER_MODEL,
  });
});

app.post('/api/tts', async (req, res) => {
  const parsed = validateText(req.body?.text);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  if (!existsSync(PIPER_BIN)) {
    return res.status(503).json({ error: 'Piper binary not found on server.' });
  }
  if (!existsSync(PIPER_MODEL)) {
    return res.status(503).json({ error: 'Alma voice model not found on server.' });
  }

  const workDir = join(tmpdir(), 'alma-tts');
  await mkdir(workDir, { recursive: true });
  const outputPath = join(workDir, `${randomUUID()}.wav`);

  try {
    await synthesizeWithPiper(parsed.text, outputPath);
    const wav = await readFile(outputPath);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(wav.length));
    res.setHeader('Cache-Control', 'no-store');
    res.send(wav);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[tts] Piper failed:', message);
    res.status(500).json({ error: 'Speech synthesis failed.', detail: message });
  } finally {
    try {
      await rm(outputPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Alma TTS listening on http://0.0.0.0:${PORT}`);
  console.log(`Piper: ${PIPER_BIN}`);
  console.log(`Model: ${PIPER_MODEL}`);
});
