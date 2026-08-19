import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkrrvsjuavjyfrzkgscd.supabase.co';
const supabaseAnonKey = 'sb_publishable_2ZTpEYsTUczcB_G_tysO7A_A1ZaeH_h';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
