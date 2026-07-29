import type { FormEvent } from 'react';
import { Send, Zap } from 'lucide-react';
import type { ChatMessage } from '../hooks/useWebRTC';
import { SideDrawer } from './SideDrawer';

interface ChatDrawerProps {
  messages: ChatMessage[];
  username: string;
  input: string;
  isReady: boolean;
  onInputChange: (value: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

/** RTCDataChannel 聊天记录及发送表单。 */
export function ChatDrawer({
  messages,
  username,
  input,
  isReady,
  onInputChange,
  onSend,
  onClose,
}: ChatDrawerProps) {
  return (
    <SideDrawer
      title={
        <>
          <Zap size={18} color="var(--accent-green)" />
          WebRTC P2P DataChannel Chat
        </>
      }
      onClose={onClose}
    >
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            No messages yet. Messages are sent <b>Directly P2P</b> via WebRTC RTCDataChannel!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-bubble ${message.senderName === username ? 'mine' : 'other'}`}
            >
              {message.senderName !== username && (
                <div className="chat-sender">{message.senderName}</div>
              )}
              <div>{message.message}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSend} className="chat-input-area">
        <input
          type="text"
          className="input-field"
          placeholder={isReady ? 'Type P2P message...' : 'Waiting for P2P connection...'}
          value={input}
          disabled={!isReady}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button type="submit" className="btn-secondary chat-send-button" disabled={!isReady}>
          <Send size={16} />
        </button>
      </form>
    </SideDrawer>
  );
}
