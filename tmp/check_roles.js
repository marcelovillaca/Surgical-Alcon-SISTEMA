import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dtrqsmygokeftoqhxvae.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cnFzbXlnb2tlZnRvcWh4dmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjUyMzgsImV4cCI6MjA4NjMwMTIzOH0.dclz97hSW0O1yJujdRJLARulTGrZc5WBlfkpcrmc8ZY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUserRoles() {
    const { data: roles, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', '190848f7-5d5f-4572-b244-74a637fc37fd');
    
    console.log("Current Roles for user:", JSON.stringify(roles, null, 2));
}

checkUserRoles();
