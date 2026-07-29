import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface SideDrawerProps {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

/** 日志和聊天模块共用的抽屉骨架。 */
export function SideDrawer({ title, children, onClose }: SideDrawerProps) {
  return (
    <aside className="side-drawer">
      <div className="drawer-header">
        <span className="drawer-title">{title}</span>
        <button className="close-drawer-btn" onClick={onClose} aria-label="Close drawer">
          <X size={18} />
        </button>
      </div>
      {children}
    </aside>
  );
}
