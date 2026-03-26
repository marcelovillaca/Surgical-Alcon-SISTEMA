const email = "test@alcon.com";
const attempts = 15;

async function bruteForceInvites() {
  console.log(`Auditing: Simulated brute force on user_invitations for ${email}...`);
  for (let i = 0; i < attempts; i++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log(`Attempt ${i + 1}/${attempts}: Checking code ${code}...`);
    
    // Simulating the request that the Auth component makes
    const response = await fetch(`https://dtrqsmygokeftoqhxvae.supabase.co/rest/v1/user_invitations?email=eq.${email}&invite_code=eq.${code}&used=eq.false`, {
      method: "GET",
      headers: {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cnFzbXlnb2tlZnRvcWh4dmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjUyMzgsImV4cCI6MjA4NjMwMTIzOH0.dclz97hSW0O1yJujdRJLARulTGrZc5WBlfkpcrmc8ZY",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cnFzbXlnb2tlZnRvcWh4dmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjUyMzgsImV4cCI6MjA4NjMwMTIzOH0.dclz97hSW0O1yJujdRJLARulTGrZc5WBlfkpcrmc8ZY"
      }
    });

    if (response.status === 429) {
      console.log("SUCCESS: Rate limit (429) triggered correctly by Supabase.");
      return;
    }
    
    if (i > 10 && response.status === 200) {
      console.log("WARNING: No rate limit triggered after 10 attempts on restricted resource!");
    }
  }
}

bruteForceInvites();
