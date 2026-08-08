import React, { useState, useEffect, useRef } from 'react';
import { Send, ShieldCheck, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyTeamChat, sendMyTeamMessage } from '../../services/api';

interface Message {
  id: number;
  message: string;
  created_at: string;
  first_name: string;
  last_name: string;
  role: string;
}

export const TeamChat: React.FC<{ teamId: number }> = ({ teamId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const data = await getMyTeamChat();
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      await sendMyTeamMessage(input);
      setInput('');
      await loadMessages();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MessageSquare size={20} color="#0284c7" /> Командный чат
      </h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
        {messages.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center' }}>Сообщений пока нет</p>
        ) : (
          messages.map((msg) => {
            const isCurator = msg.role === 'admin' || msg.role === 'moderator';
            return (
              <div key={msg.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                    {msg.last_name} {msg.first_name}
                  </span>
                  {isCurator && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                      <ShieldCheck size={12} /> куратор
                    </span>
                  )}
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#334155', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                  {msg.message}
                </p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напишите сообщение..."
          disabled={loading}
          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Send size={16} /> {loading ? 'Отправка...' : 'Отправить'}
        </button>
      </form>
    </div>
  );
};