import { Terminal } from 'lucide-react';
import type { LogEntry } from '../hooks/useWebRTC';
import { SideDrawer } from './SideDrawer';

interface LogDrawerProps {
  logs: LogEntry[];
  onClose: () => void;
}

/** 展示信令、ICE 和 DataChannel 的诊断日志。 */
export function LogDrawer({ logs, onClose }: LogDrawerProps) {
  return (
    <SideDrawer
      title={
        <>
          <Terminal size={18} color="var(--accent-cyan)" />
          Signaling & DataChannel Logs
        </>
      }
      onClose={onClose}
    >
      <div className="log-list">
        {logs.map((log) => (
          <div key={log.id} className={`log-item ${log.type}`}>
            <div className="log-time">[{log.time}]</div>
            <div>{log.text}</div>
          </div>
        ))}
      </div>
    </SideDrawer>
  );
}
