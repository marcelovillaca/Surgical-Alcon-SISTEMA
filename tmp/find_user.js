import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dtrqsmygokeftoqhxvae.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cnFzbXlnb2tlZnRvcWh4dmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjUyMzgsImV4cCI6MjA4NjMwMTIzOH0.dclz97hSW0O1yJujdRJLARulTGrZc5WBlfkpcrmc8ZY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findUser() {
    // Try profiles first
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*');
    
    console.log("Profiles:", JSON.stringify(profiles, null, 2));
}

findUser();
