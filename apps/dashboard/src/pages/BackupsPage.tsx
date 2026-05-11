import { useEffect, useState } from 'react';
import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';
import { shamsiDate } from '../lib/format';

export function BackupsPage() {
  const { backups, backupInterval, updateBackupSettings, runBackup, downloadProtected } = useBestContext();
  const [intervalInput, setIntervalInput] = useState(String(backupInterval));

  useEffect(() => {
    setIntervalInput(String(backupInterval));
  }, [backupInterval]);

  return (
    <section className="grid-2">
      <Panel>
        <h2>{'\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0628\u06a9\u0627\u067e'}</h2>
        <input
          value={intervalInput}
          onChange={(e) => setIntervalInput(e.target.value)}
          placeholder={'\u062f\u0642\u06cc\u0642\u0647'}
        />
        <div className="actions">
          <button onClick={() => void updateBackupSettings(Number(intervalInput || 1440))}>
            {'\u0630\u062e\u06cc\u0631\u0647 \u0632\u0645\u0627\u0646\u200c\u0628\u0646\u062f\u06cc'}
          </button>
          <button onClick={() => void runBackup()}>
            {'\u0627\u062c\u0631\u0627\u06cc \u0628\u06a9\u0627\u067e \u062f\u0633\u062a\u06cc'}
          </button>
        </div>
      </Panel>

      <Panel>
        <h2>{'\u0644\u06cc\u0633\u062a \u0628\u06a9\u0627\u067e\u200c\u0647\u0627'}</h2>
        <table>
          <thead>
            <tr>
              <th>{'\u0632\u0645\u0627\u0646'}</th>
              <th>{'\u0648\u0636\u0639\u06cc\u062a'}</th>
              <th>{'\u0641\u0627\u06cc\u0644\u200c\u0647\u0627'}</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.id}>
                <td>{shamsiDate(backup.createdAt)}</td>
                <td>{backup.status}</td>
                <td>
                  <div className="actions">
                    <button type="button" onClick={() => void downloadProtected(`/backups/${backup.id}/sql`)}>
                      SQL
                    </button>
                    {backup.excelFiles?.map((file) => (
                      <button key={file} type="button" onClick={() => void downloadProtected(`/backups/${backup.id}/excel?file=${encodeURIComponent(file)}`, file)}>
                        {file}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  );
}
