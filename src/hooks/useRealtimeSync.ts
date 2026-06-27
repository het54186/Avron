import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSync(
  tables: string[],
  onChange: () => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const channel = supabase.channel('app-realtime');
    tables.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
