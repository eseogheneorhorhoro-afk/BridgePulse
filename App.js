
import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

// Connect backend links safely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function BridgePulseApp({ caseId }) {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const session = supabase.auth.getSession();
    setUser(session?.user ?? null);

    if (session?.user) {
      loadMessages();

      // Hook up live network stream
      const channel = supabase
        .channel('live-mediation')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'case_messages', filter: `case_id=eq.${caseId}` }, 
          (payload) => {
            setMessages((current) => [...current, payload.new]);
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
    setLoading(false);
  }, [caseId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('case_messages')
      .select('id, message_content, created_at, profiles(full_name, role)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  };

  const handlePostMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await supabase.from('case_messages').insert([
      { case_id: caseId, sender_id: user.id, message_content: newMessage }
    ]);
    setNewMessage('');
  };

  if (loading) return <p>Securing negotiation room access...</p>;
  if (!user) return <p>Access Blocked: Please log in using verified school credentials.</p>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🕊️ BridgePulse Mediation Room</h2>
      <div style={{ border: '1px solid #ccc', padding: '15px', height: '300px', overflowY: 'scroll', marginBottom: '10px', borderRadius: '8px' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ margin: '10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
            <small style={{ color: '#666' }}>{msg.profiles?.full_name} ({msg.profiles?.role})</small>
            <p style={{ margin: '4px 0' }}>{msg.message_content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handlePostMessage} style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type draft terms or mediation proposals calmly..." 
          style={{ flexGrow: 1, padding: '10px', borderRadius: '4px', border: '1px solid #aaa' }}
        />
        <button type="submit" style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
}
