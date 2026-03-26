import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dtrqsmygokeftoqhxvae.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cnFzbXlnb2tlZnRvcWh4dmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjUyMzgsImV4cCI6MjA4NjMwMTIzOH0.dclz97hSW0O1yJujdRJLARulTGrZc5WBlfkpcrmc8ZY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setGerenteRole() {
    const userId = "190848f7-5d5f-4572-b244-74a637fc37fd"; // Based on profiles check
    
    // Check if user_id is different from id in profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    const uid = profile.user_id || profile.id;

    console.log("Setting role for UID:", uid);

    const { data, error } = await supabase
        .from('user_roles')
        .upsert({ user_id: uid, role: 'gerente' });
    
    if (error) {
        console.error("Error setting role:", error);
    } else {
        console.log("Successfully set role to gerente for", uid);
    }
}

setGerenteRole();
