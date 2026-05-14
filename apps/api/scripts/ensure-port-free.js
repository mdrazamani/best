const { execSync } = require('child_process');

const port = Number(process.env.PORT || 3000);

function parseWindowsPids(raw) {
  const pids = new Set();
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.toUpperCase().includes('LISTENING')) continue;
    const cols = line.split(/\s+/);
    const pid = Number(cols[cols.length - 1]);
    if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function parseUnixPids(raw) {
  const pids = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const pid = Number(line.trim());
    if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function findListeningPids(targetPort) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return parseWindowsPids(out);
    }

    const out = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return parseUnixPids(out);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

const pids = findListeningPids(port);

if (!pids.length) {
  console.log(`[ensure-port-free] Port ${port} is already free.`);
  process.exit(0);
}

const killed = [];
for (const pid of pids) {
  if (killPid(pid)) {
    killed.push(pid);
  }
}

if (!killed.length) {
  console.error(`[ensure-port-free] Failed to release port ${port}.`);
  process.exit(1);
}

console.log(`[ensure-port-free] Released port ${port} by stopping PID(s): ${killed.join(', ')}`);
