const DB_NAME = 'tribuna360-offline';
const DB_VERSION = 1;
const MATCHES = 'matches';
const TICKETS = 'tickets';
const SCANS = 'scans';

let databasePromise;

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = resolve;
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error || new Error('La transacción offline fue cancelada.'));
});

const openDatabase = () => {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Este navegador no permite guardar datos offline.'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore(MATCHES, { keyPath: 'id' });
      const tickets = database.createObjectStore(TICKETS, { keyPath: 'key' });
      tickets.createIndex('match_id', 'match_id');
      const scans = database.createObjectStore(SCANS, { keyPath: 'ticket_key' });
      scans.createIndex('match_id', 'match_id');
      scans.createIndex('client_scan_id', 'client_scan_id', { unique: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error);
    };
  });

  return databasePromise;
};

export async function saveOfflineManifest({ match, tickets, downloaded_at }) {
  const database = await openDatabase();
  const transaction = database.transaction([MATCHES, TICKETS], 'readwrite');
  const done = transactionDone(transaction);
  const ticketStore = transaction.objectStore(TICKETS);
  const cursorRequest = ticketStore.index('match_id').openCursor(IDBKeyRange.only(match.id));

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
      return;
    }

    for (const ticket of tickets) {
      ticketStore.put({
        key: `${match.id}:${ticket.qr_code}`,
        match_id: match.id,
        qr_code: ticket.qr_code,
        status: ticket.status,
        zone_name: ticket.zones?.name || 'General',
      });
    }
  };
  transaction.objectStore(MATCHES).put({ ...match, downloaded_at });

  await done;
  return tickets.length;
}

export async function getOfflineMatches(tenantId, allowAll = false) {
  const database = await openDatabase();
  const transaction = database.transaction(MATCHES, 'readonly');
  const done = transactionDone(transaction);
  const matches = await requestResult(transaction.objectStore(MATCHES).getAll());
  await done;
  if (tenantId) return matches.filter((match) => match.tenant_id === tenantId);
  return allowAll ? matches : [];
}

export async function recordOfflineScan(matchId, qrCode) {
  const database = await openDatabase();
  const transaction = database.transaction([TICKETS, SCANS], 'readwrite');
  const ticketKey = `${matchId}:${qrCode}`;
  const ticketRequest = transaction.objectStore(TICKETS).get(ticketKey);
  const scanRequest = transaction.objectStore(SCANS).get(ticketKey);

  return new Promise((resolve, reject) => {
    let ticket;
    let existingScan;
    let completed = 0;
    let result;
    const finish = () => {
      completed += 1;
      if (completed !== 2) return;

      if (!ticket) {
        result = { ok: false, message: 'Entrada no descargada para este partido. Conéctate y actualiza los datos offline.' };
      } else if (ticket.status !== 'valid') {
        result = { ok: false, message: 'La entrada no está habilitada.' };
      } else if (existingScan) {
        result = { ok: false, message: 'Esta entrada ya fue escaneada en este dispositivo.' };
      } else {
        const scan = {
          ticket_key: ticketKey,
          match_id: matchId,
          qr_code: qrCode,
          client_scan_id: window.crypto.randomUUID(),
          scanned_at: new Date().toISOString(),
          status: 'pending',
        };
        transaction.objectStore(SCANS).put(scan);
        result = {
          ok: true,
          scan,
          ticket: { zones: { name: ticket.zone_name } },
          message: `Acceso permitido localmente — Zona: ${ticket.zone_name}. Pendiente de sincronizar.`,
        };
      }
    };

    ticketRequest.onsuccess = () => {
      ticket = ticketRequest.result;
      finish();
    };
    scanRequest.onsuccess = () => {
      existingScan = scanRequest.result;
      finish();
    };
    ticketRequest.onerror = () => reject(ticketRequest.error);
    scanRequest.onerror = () => reject(scanRequest.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar el escaneo offline.'));
  });
}

export async function getPendingOfflineScans(matchId) {
  const database = await openDatabase();
  const transaction = database.transaction(SCANS, 'readonly');
  const done = transactionDone(transaction);
  const scans = await requestResult(
    transaction.objectStore(SCANS).index('match_id').getAll(IDBKeyRange.only(matchId))
  );
  await done;
  return scans.filter((scan) => scan.status === 'pending');
}

export async function updateOfflineScanResults(results) {
  const database = await openDatabase();
  const transaction = database.transaction(SCANS, 'readwrite');
  const scans = transaction.objectStore(SCANS);

  for (const result of results) {
    const request = scans.index('client_scan_id').get(result.client_scan_id);
    request.onsuccess = () => {
      if (request.result) {
        scans.put({
          ...request.result,
          status: result.status,
          server_message: result.message,
        });
      }
    };
  }

  await transactionDone(transaction);
}

export async function getOfflineScanStats(matchId) {
  const database = await openDatabase();
  const transaction = database.transaction(SCANS, 'readonly');
  const done = transactionDone(transaction);
  const scans = await requestResult(
    transaction.objectStore(SCANS).index('match_id').getAll(IDBKeyRange.only(matchId))
  );
  await done;
  return scans.reduce((stats, scan) => {
    stats[scan.status] = (stats[scan.status] || 0) + 1;
    return stats;
  }, { pending: 0, synced: 0, conflict: 0, invalid: 0 });
}
