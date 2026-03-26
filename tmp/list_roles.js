import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dtrqsmygokeftoqhxvae.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cnFzbXlnb2tlZnRvcWh4dmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjUyMzgsImV4cCI6MjA4NjMwMTIzOH0.dclz97hSW0O1yJujdRJLARulTGrZc5WBlfkpcrmc8ZY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listRoles() {
    const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .limit(5);
    
    console.log("Sample Roles:", JSON.stringify(roles, null, 2));
}

listRoles();
